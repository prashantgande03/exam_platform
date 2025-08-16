import axios from 'axios'

// Detect backend base URL from current host and protocol (assumes backend on :8000)
const host = window.location.hostname
const proto = window.location.protocol // 'http:' or 'https:'
const isDev = window.location.port === '5173'
export const API_BASE = isDev ? '/api' : `${proto}//${host}:8000`

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

// MCQ endpoints
export async function createMcq(payload) {
  const { data } = await api.post('/mcq/questions', payload)
  return data
}

export async function updateMcq(id, payload) {
  const { data } = await api.put(`/mcq/questions/${id}`, payload)
  return data
}

export async function listMcq() {
  const { data } = await api.get('/mcq/questions')
  return data
}

export async function submitMcq(answers) {
  const { data } = await api.post('/mcq/submit', { answers })
  return data
}

// Lab endpoints
export async function listLabTasks() {
  const { data } = await api.get('/lab/tasks')
  return data
}

export async function createLabTask(form) {
  // form: FormData with fields title, instructions, marks, is_active, resource?
  const { data } = await api.post('/lab/tasks', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return data
}

export async function updateLabTask(id, form) {
  const { data } = await api.put(`/lab/tasks/${id}`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return data
}

export async function submitLabFile(taskId, file) {
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await api.post(`/lab/tasks/${taskId}/submit`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  return data
}

export async function listLabSubmissions() {
  const { data } = await api.get('/lab/submissions')
  return data
}

export function downloadLabSubmissionFile(subId) {
  window.location.href = `${API_BASE}/lab/submissions/${subId}/file`
}

export async function scoreLabSubmission(subId, payload) {
  const { data } = await api.post(`/lab/submissions/${subId}/score`, payload)
  return data
}
