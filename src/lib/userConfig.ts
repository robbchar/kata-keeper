import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { firebase } from '@/lib/firebase'
import type { UserConfig } from '@/types/config'

export const DEFAULT_TAGS = [
  'hooks',
  'async',
  'state',
  'forms',
  'routing',
  'testing',
  'performance',
  'a11y',
  'arrays',
  'strings',
  'algorithms',
  'api',
]

function configDoc(uid: string) {
  return doc(firebase().db, 'kata-keeper', 'users', uid)
}

export async function getUserConfig(uid: string): Promise<UserConfig> {
  const snap = await getDoc(configDoc(uid))

  if (!snap.exists()) {
    const defaults: UserConfig = {
      aiProvider: 'openai',
      aiApiKey: '',
      csToken: '',
      csGitHubConnected: false,
      tags: DEFAULT_TAGS,
    }
    await setDoc(configDoc(uid), defaults)
    return defaults
  }

  return snap.data() as UserConfig
}

export async function updateUserConfig(uid: string, patch: Partial<UserConfig>): Promise<void> {
  await updateDoc(configDoc(uid), patch)
}
