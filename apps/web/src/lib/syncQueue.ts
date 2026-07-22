import { supabase } from './supabase'

export type SyncQueueType = 'transaction' | 'customer'

export interface SyncQueueItem {
  id: string              // Unique ID (matches client_id)
  type: SyncQueueType
  client_id: string
  payload: any            // Full DB payload
  status: 'pending' | 'syncing' | 'failed'
  createdAt: number
  retryCount: number
  nextAttemptAt: number   // Timestamp in ms
  errorMessage?: string
}

const STORAGE_KEY = '@khataclone/sync_queue'

const PERMANENT_POSTGRES_CODES = new Set([
  '22003', // numeric_value_out_of_range
  '22P02', // invalid_text_representation
  '23514', // check_violation
  '42501', // insufficient_privilege / RLS violation
  '23502', // not_null_violation
  '23503', // foreign_key_violation
  '42703', // undefined_column
  '42P01', // undefined_table
])

export function isPermanentError(err: any): boolean {
  if (!err) return false

  const code = String(err.code || '')
  if (PERMANENT_POSTGRES_CODES.has(code)) return true

  const status = Number(err.status || 0)
  // HTTP 400, 401, 403, 422 are permanent client/validation errors
  if (status >= 400 && status < 500 && status !== 409 && status !== 429) {
    return true
  }

  const msg = String(err.message || '').toLowerCase()
  if (
    msg.includes('out of range') ||
    msg.includes('check constraint') ||
    msg.includes('violates row-level security') ||
    msg.includes('invalid input syntax') ||
    (msg.includes('column') && msg.includes('does not exist'))
  ) {
    return true
  }

  return false
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Queue listeners
type SyncSuccessCallback = (type: SyncQueueType, client_id: string, syncedData: any) => void
type SyncFailureCallback = (type: SyncQueueType, client_id: string, errorMessage: string) => void
type QueueCountCallback = (count: number) => void

const syncSuccessListeners: Set<SyncSuccessCallback> = new Set()
const syncFailureListeners: Set<SyncFailureCallback> = new Set()
const queueCountListeners: Set<QueueCountCallback> = new Set()

export function onSyncSuccess(cb: SyncSuccessCallback): () => void {
  syncSuccessListeners.add(cb)
  return () => syncSuccessListeners.delete(cb)
}

export function onSyncFailure(cb: SyncFailureCallback): () => void {
  syncFailureListeners.add(cb)
  return () => syncFailureListeners.delete(cb)
}

export function subscribePendingCount(cb: QueueCountCallback): () => void {
  queueCountListeners.add(cb)
  getPendingCount().then((count) => cb(count))
  return () => queueCountListeners.delete(cb)
}

async function notifyPendingCountChanged() {
  const count = await getPendingCount()
  queueCountListeners.forEach((cb) => cb(count))
}

export async function loadQueue(): Promise<SyncQueueItem[]> {
  try {
    const json = localStorage.getItem(STORAGE_KEY)
    if (!json) return []
    return JSON.parse(json) as SyncQueueItem[]
  } catch (err) {
    console.error('[syncQueue] Error loading web queue:', err)
    return []
  }
}

export async function saveQueue(queue: SyncQueueItem[]): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
    await notifyPendingCountChanged()
  } catch (err) {
    console.error('[syncQueue] Error saving web queue:', err)
  }
}

export async function getPendingCount(): Promise<number> {
  const queue = await loadQueue()
  return queue.filter((i) => i.status === 'pending').length
}

export async function enqueueItem(type: SyncQueueType, payload: any): Promise<SyncQueueItem> {
  const client_id = payload.client_id || generateUUID()
  const item: SyncQueueItem = {
    id: client_id,
    type,
    client_id,
    payload: { ...payload, client_id },
    status: 'pending',
    createdAt: Date.now(),
    retryCount: 0,
    nextAttemptAt: Date.now(),
  }

  const queue = await loadQueue()
  queue.push(item)
  await saveQueue(queue)

  processQueue()

  return item
}

let isProcessing = false
let scheduledTimeout: ReturnType<typeof setTimeout> | null = null

function scheduleNextTimer(queue: SyncQueueItem[]) {
  if (scheduledTimeout) {
    clearTimeout(scheduledTimeout)
    scheduledTimeout = null
  }

  const pendingItems = queue.filter((i) => i.status === 'pending')
  if (pendingItems.length === 0) return

  const earliestMs = Math.min(...pendingItems.map((i) => i.nextAttemptAt))
  const delay = Math.max(0, earliestMs - Date.now())

  scheduledTimeout = setTimeout(() => {
    processQueue()
  }, delay)
}

export async function processQueue(): Promise<void> {
  if (isProcessing) return
  isProcessing = true

  try {
    const queue = await loadQueue()
    const now = Date.now()

    const eligibleItems = queue.filter(
      (item) => item.status === 'pending' && item.nextAttemptAt <= now
    )

    if (eligibleItems.length === 0) {
      scheduleNextTimer(queue)
      return
    }

    await Promise.allSettled(
      eligibleItems.map(async (item) => {
        item.status = 'syncing'
        await saveQueue(queue)

        try {
          const table = item.type === 'transaction' ? 'transactions' : 'customers'
          const { data, error } = await supabase
            .from(table)
            .insert(item.payload)
            .select()
            .single()

          if (error) throw error

          await removeQueueItem(item.id)
          syncSuccessListeners.forEach((cb) => cb(item.type, item.client_id, data))
        } catch (err: any) {
          console.error('[syncQueue INSERT ERROR DETAILS]', {
            type: item.type,
            client_id: item.client_id,
            payload: item.payload,
            message: err?.message,
            code: err?.code,
            details: err?.details,
            hint: err?.hint,
            status: err?.status,
            rawError: err,
          })

          const isUniqueViolation =
            err?.code === '23505' ||
            err?.status === 409 ||
            err?.message?.toLowerCase().includes('unique constraint') ||
            err?.message?.toLowerCase().includes('duplicate key')

          if (isUniqueViolation) {
            const table = item.type === 'transaction' ? 'transactions' : 'customers'
            const { data: existingData } = await supabase
              .from(table)
              .select('*')
              .eq('client_id', item.client_id)
              .single()

            await removeQueueItem(item.id)
            syncSuccessListeners.forEach((cb) =>
              cb(item.type, item.client_id, existingData || item.payload)
            )
          } else if (isPermanentError(err)) {
            // Permanent error: STOP retrying, mark status = 'failed'
            const errMsg = err?.message || 'Permanent database sync error'
            const currentQueue = await loadQueue()
            const queueItem = currentQueue.find((q) => q.id === item.id)

            if (queueItem) {
              queueItem.status = 'failed'
              queueItem.errorMessage = errMsg
              await saveQueue(currentQueue)
            }

            syncFailureListeners.forEach((cb) => cb(item.type, item.client_id, errMsg))
          } else {
            // Temporary error (network / 5xx / offline): retry with exponential backoff
            const currentQueue = await loadQueue()
            const queueItem = currentQueue.find((q) => q.id === item.id)

            if (queueItem) {
              const newRetryCount = queueItem.retryCount + 1
              const backoffMs = Math.min(1000 * Math.pow(2, newRetryCount), 30000)

              queueItem.status = 'pending'
              queueItem.retryCount = newRetryCount
              queueItem.nextAttemptAt = Date.now() + backoffMs
              queueItem.errorMessage = err?.message || 'Network error'
              await saveQueue(currentQueue)
            }
          }
        }
      })
    )
  } catch (err) {
    console.error('[syncQueue] Error in processQueue:', err)
  } finally {
    isProcessing = false
    const finalQueue = await loadQueue()
    scheduleNextTimer(finalQueue)
  }
}

export async function removeQueueItem(id: string): Promise<void> {
  const queue = await loadQueue()
  const filtered = queue.filter((item) => item.id !== id)
  await saveQueue(filtered)
}

export async function initSyncQueue(): Promise<void> {
  const queue = await loadQueue()
  let modified = false
  queue.forEach((item) => {
    if (item.status === 'syncing') {
      item.status = 'pending'
      item.nextAttemptAt = Date.now()
      modified = true
    }
  })
  if (modified) {
    await saveQueue(queue)
  }

  processQueue()
}
