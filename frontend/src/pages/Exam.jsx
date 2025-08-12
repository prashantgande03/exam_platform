import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getQuestions, submitAnswers } from '../services/api'
import { useAuth, useExam } from '../store'
import AntiCheatGuard from '../components/AntiCheatGuard'

function useTimer(startedAt, durationSec, onExpire) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])
  const remaining = useMemo(() => {
    if (!startedAt) return durationSec
    const elapsed = Math.floor((now - startedAt) / 1000)
    return Math.max(0, durationSec - elapsed)
  }, [now, startedAt, durationSec])
  useEffect(() => { if (remaining === 0 && onExpire) onExpire() }, [remaining, onExpire])
  return remaining
}

export default function Exam() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const { startedAt, start, answers, setAnswer, reset, durationSec } = useExam()
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [violations, setViolations] = useState(0)

  useEffect(() => {
    if (!token) navigate('/login')
  }, [token])

  useEffect(() => {
    (async () => {
      try {
        const qs = await getQuestions()
        setQuestions(qs)
        if (!startedAt) start()
      } catch (e) {
        setError('Failed to load questions')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const onExpire = () => onSubmit()
  const remaining = useTimer(startedAt, durationSec, onExpire)

  const onViolation = () => setViolations((v)=>v+1)

  const onSubmit = async () => {
    const payload = questions.map(q => ({ question_id: q.id, response: answers[q.id] || '' }))
    try {
      const data = await submitAnswers(payload)
      reset()
      navigate('/result', { state: data })
    } catch (e) {
      alert('Submit failed')
    }
  }

  if (loading) return <div>Loading…</div>
  if (error) return <div className="text-red-600">{error}</div>

  return (
    <div>
      <AntiCheatGuard onViolation={onViolation} />
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600">Anti-cheat violations: {violations}</div>
        <div className="font-mono">Time left: {Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</div>
      </div>
      {questions.map(q => (
        <div key={q.id} className="card mb-4">
          <div className="font-semibold mb-1">{q.title} <span className="text-sm text-gray-500">({q.marks} marks)</span></div>
          <div className="mb-2 whitespace-pre-wrap">{q.prompt}</div>
          <textarea className="input min-h-[120px]" value={answers[q.id]||''} onChange={(e)=>setAnswer(q.id, e.target.value)} />
        </div>
      ))}
      <button className="btn" onClick={onSubmit}>Submit</button>
    </div>
  )
}
