import axios from 'axios'

// Detect backend base URL from current host (assumes backend on :8000)
const host = window.location.hostname
export const API_BASE = `http://${host}:8000`

export const api = axios.create({
  baseURL: API_BASE,
})

export function setAuth(token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

export async function login(username, password) {
  const params = new URLSearchParams()
  params.append('username', username)
  params.append('password', password)
  const { data } = await api.post('/auth/token', params)
  setAuth(data.access_token)
  return data
}

export async function signup(username, password, role='student') {
  const { data } = await api.post('/auth/signup', { username, password, role })
  setAuth(data.access_token)
  return data
}

export async function getQuestions() {
  const { data } = await api.get('/questions')
  return data
}

export async function submitAnswers(answers) {
  const { data } = await api.post('/submit', { answers })
  return data
}

export async function getResultsCsv() {
  const url = `${API_BASE}/admin/results.csv`
  window.location.href = url
}

export async function getResults() {
  const { data } = await api.get('/admin/results')
  return data
}
