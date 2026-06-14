import axios from 'axios'

import { apiBaseUrl, whepBaseUrl } from '@/api/env'

export const apiClient = axios.create({
  baseURL: apiBaseUrl(),
})

export const whepClient = axios.create({
  baseURL: whepBaseUrl(),
  headers: { 'Content-Type': 'application/sdp' },
  responseType: 'text',
  transformResponse: [(data: string) => data],
})
