import { useAuthStore } from '../store/authStore'
import { View, Text } from 'react-native'

export default function AppEntry() {
  const { isLoading, session, profile } = useAuthStore()
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text>isLoading: {String(isLoading)}</Text>
      <Text>session: {session ? 'exists' : 'null'}</Text>
      <Text>profile: {profile ? 'exists' : 'null'}</Text>
    </View>
  )
}
