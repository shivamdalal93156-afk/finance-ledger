require('dotenv').config()
const TelegramBot = require('node-telegram-bot-api')
const { createClient } = require('@supabase/supabase-js')

const BOT_TOKEN = process.env.BOT_TOKEN
const AUTHORIZED_CHAT_ID = process.env.AUTHORIZED_CHAT_ID
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

const bot = new TelegramBot(BOT_TOKEN, { polling: true })
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Pending state per chat
const pendingState = {}

const activeAccount = {} // chatId -> { userId, accountName }
const lastTransaction = {} // chatId -> transactionId

function getLocalDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseMessage(text) {
  const lower = text.toLowerCase().trim()
  
  let name, rawAmount, verb, dateStr
  const matchA = lower.match(/^(.+?)\s+([₹\d,]+)\s+(aaye|aaya|aai|aaye the|aaye hain|aane hain|aane the|mile|milе hain|diye|diya|de diye|gaye|gaya|gai|gaye the|gaye hain|de diya|bheje|bheja)(?:\s+(.+))?$/)
  
  if (matchA) {
    name = matchA[1].trim()
    rawAmount = matchA[2]
    verb = matchA[3]
    dateStr = matchA[4]?.trim() || null
  } else {
    const matchB = lower.match(/^([₹\d,]+)\s+(.+?)\s+(aaye|aaya|aai|aaye the|aaye hain|aane hain|aane the|mile|milе hain|diye|diya|de diye|gaye|gaya|gai|gaye the|gaye hain|de diya|bheje|bheja)(?:\s+(.+))?$/)
    if (matchB) {
      rawAmount = matchB[1]
      name = matchB[2].trim()
      verb = matchB[3]
      dateStr = matchB[4]?.trim() || null
    } else {
      return null
    }
  }

  const cleanAmount = rawAmount.replace(/[,₹]/g, '')
  const amount = parseInt(cleanAmount)
  if (isNaN(amount) || amount <= 0 || amount > 10000000) return null

  const creditWords = ['aaye','aaya','aai','aaye the','aaye hain','aane hain','aane the','mile','mile hain']
  const type = creditWords.some(w => verb.startsWith(w)) ? 'credit' : 'debit'

  let entryDate = getLocalDateString(new Date()) // default today

  if (dateStr) {
    if (dateStr === 'kal' || dateStr === 'kl') {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      entryDate = getLocalDateString(d)
    } else if (dateStr === 'aaj' || dateStr === 'aj') {
      entryDate = getLocalDateString(new Date())
    } else {
      // Normalize: extract day, month, optional year
      const parts = dateStr.trim().split(/\s+/)
      const monthMap = {
        'jan': '01', 'january': '01',
        'feb': '02', 'february': '02',
        'mar': '03', 'march': '03',
        'apr': '04', 'april': '04',
        'may': '05', 'mai': '05',
        'jun': '06', 'june': '06',
        'jul': '07', 'july': '07',
        'aug': '08', 'august': '08',
        'sep': '09', 'september': '09',
        'oct': '10', 'october': '10',
        'nov': '11', 'november': '11',
        'dec': '12', 'december': '12'
      }
      
      let day = null, month = null, year = new Date().getFullYear()
      
      parts.forEach(p => {
        if (/^\d{4}$/.test(p)) year = parseInt(p)
        else if (/^\d{1,2}$/.test(p)) day = p.padStart(2, '0')
        else if (monthMap[p]) month = monthMap[p]
      })
      
      if (day && month) {
        entryDate = `${year}-${month}-${day}`
      }
      // if parsing failed, entryDate stays as today — safe default
    }
  }

  return { name, amount, type, entryDate }
}

async function showAccountSelector(chatId) {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, business_name, owner_name')
  
  if (!profiles || profiles.length === 0) {
    bot.sendMessage(chatId, '❌ Koi account nahi mila.')
    return
  }

  let msg = '👤 Kaun sa account use karna hai? Number bhejo:\n\n'
  profiles.forEach((p, i) => {
    const name = p.owner_name || 'No name'
    const biz = p.business_name || 'No business'
    msg += `${i + 1}. ${name} - ${biz}\n`
  })
  
  pendingState[chatId] = {
    type: 'select_account',
    profiles: profiles
  }
  
  bot.sendMessage(chatId, msg)
}

async function getBalanceText(customerId, userId) {
  const { data: txns } = await supabase
    .from('transactions')
    .select('amount, type')
    .eq('customer_id', customerId)
    .eq('user_id', userId)

  let balance = 0
  txns?.forEach(t => {
    if (t.type === 'credit') balance += t.amount
    else balance -= t.amount
  })

  return balance >= 0 
    ? `💰 Current Balance: ₹${balance} (aapko lena hai)`
    : `💰 Current Balance: ₹${Math.abs(balance)} (aapne dena hai)`
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id.toString()
  if (chatId !== AUTHORIZED_CHAT_ID) return
  showAccountSelector(chatId)
})

bot.onText(/\/switch/, (msg) => {
  const chatId = msg.chat.id.toString()
  if (chatId !== AUTHORIZED_CHAT_ID) return
  showAccountSelector(chatId)
})

bot.on('message', async (msg) => {
  const chatId = msg.chat.id.toString()
  const text = msg.text?.trim()
  
  if (!text) return
  
  // Security - only authorized user
  if (chatId !== AUTHORIZED_CHAT_ID) {
    bot.sendMessage(chatId, '❌ Unauthorized')
    return
  }

  // Ignore commands so they are only handled by bot.onText
  if (text.startsWith('/')) return

  // Guard all entry commands
  if (!activeAccount[chatId] && !pendingState[chatId]) {
    showAccountSelector(chatId)
    return
  }

  // Handle pending confirmations
  if (pendingState[chatId]) {
    const state = pendingState[chatId]

    if (state.type === 'select_account') {
      const num = parseInt(text)
      if (num >= 1 && num <= state.profiles.length) {
        const selected = state.profiles[num - 1]
        activeAccount[chatId] = {
          userId: selected.id,
          accountName: `${selected.owner_name || 'No name'} - ${selected.business_name || 'No business'}`
        }
        delete pendingState[chatId]
        bot.sendMessage(chatId, `✅ Account set ho gaya:\n\n🏪 ${activeAccount[chatId].accountName}`)
      } else {
        bot.sendMessage(chatId, 'Sahi number bhejo list mein se.')
      }
      return
    }
  }

  // Parse new entry command
  const parsed = parseMessage(text)
  if (parsed) {
    bot.sendMessage(chatId, '❌ Bot entry disabled, please use the app.')
    return
  }

  // Fallback for other non-command text
  bot.sendMessage(chatId, '❌ Bot entry disabled, please use the app.')
})

bot.onText(/\/account/, (msg) => {
  const chatId = msg.chat.id.toString()
  if (chatId !== AUTHORIZED_CHAT_ID) return
  if (!activeAccount[chatId]) {
    bot.sendMessage(chatId, '❌ Koi account select nahi hai. /start bhejo.')
    return
  }
  bot.sendMessage(chatId, `✅ Active Account:\n\n🏪 ${activeAccount[chatId].accountName}`)
})

bot.onText(/\/undo/, async (msg) => {
  const chatId = msg.chat.id.toString()
  if (chatId !== AUTHORIZED_CHAT_ID) return
  
  if (!lastTransaction[chatId]) {
    bot.sendMessage(chatId, '❌ Koi recent entry nahi hai undo karne ke liye.')
    return
  }
  
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', lastTransaction[chatId])
  
  if (error) {
    bot.sendMessage(chatId, `❌ Undo fail ho gaya: ${error.message}`)
  } else {
    bot.sendMessage(chatId, '✅ Last entry undo ho gayi.')
    delete lastTransaction[chatId]
  }
})

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id.toString()
  if (chatId !== AUTHORIZED_CHAT_ID) return
  bot.sendMessage(chatId, 
`📖 Commands:

/start - Account select karo
/switch - Account change karo  
/account - Current account dekho
/help - Yeh message

⚠️ Note: Transaction entry via bot is disabled. Please use the mobile or web app to log entries.`)
})

console.log('KhataClone Bot chal raha hai...')
