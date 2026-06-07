import axios from 'axios'

import { apiBaseUrl, env } from '@/api/env'

export const apiClient = axios.create({
  baseURL: apiBaseUrl(),
})

export const whepClient = axios.create({
  baseURL: `http://${env.rpiHost}:${env.webrtcPort}`,
  headers: { 'Content-Type': 'application/sdp' },
  responseType: 'text',
  transformResponse: [(data: string) => data],
})
