import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getQuestions, submitAnswers, listMcq, submitMcq, listLabTasks, submitLabFile, API_BASE } from '../services/api'
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
  const [mcqs, setMcqs] = useState([])
  const [mcqSel, setMcqSel] = useState({}) // { [qid]: index }
  const [labTasks, setLabTasks] = useState([])
  const [labFiles, setLabFiles] = useState({}) // { [taskId]: File }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [violations, setViolations] = useState(0)

  useEffect(() => {
    if (!token) navigate('/login')
  }, [token])

  useEffect(() => {
    (async () => {
      try {
        const [qs, mqs, labs] = await Promise.all([
          getQuestions(),
          listMcq(),
          listLabTasks(),
        ])
        setQuestions(qs)
        setMcqs(mqs)
        setLabTasks(labs)
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

  const onSubmitMcq = async () => {
    const answersPayload = Object.entries(mcqSel)
      .filter(([qid, idx]) => typeof idx === 'number' && !Number.isNaN(idx))
      .map(([qid, idx]) => ({ question_id: Number(qid), selected_index: idx }))
    if (answersPayload.length === 0) {
      alert('Select at least one MCQ answer')
      return
    }
    try {
      const data = await submitMcq(answersPayload)
      navigate('/result', { state: data })
    } catch (e) {
      alert('MCQ submit failed')
    }
  }

  const onUploadLab = async (taskId) => {
    const file = labFiles[taskId]
    if (!file) { alert('Pick a file to upload'); return }
    try {
      await submitLabFile(taskId, file)
      alert('Uploaded')
    } catch (e) {
      alert('Upload failed')
    }
  }

  const onDownloadResource = async (task) => {
    const host = window.location.hostname
    const candidates = [
      `https://${host}:8000${task.resource_url}`,
      `${API_BASE}${task.resource_url}`,
    ]
    for (const url of candidates) {
      try {
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        if (!resp.ok) continue
        const blob = await resp.blob()
        const disp = resp.headers.get('content-disposition') || ''
        let filename = `${task.title || 'resource'}`
        const match = /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i.exec(disp)
        if (match) filename = decodeURIComponent(match[1] || match[2])
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        return
      } catch {}
    }
    alert('Unable to download resource')
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
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-semibold mb-2">Scenario Questions</h2>
          {questions.map(q => (
            <div key={q.id} className="card mb-4">
              <div className="font-semibold mb-1">{q.title} <span className="text-sm text-gray-500">({q.marks} marks)</span></div>
              <div className="mb-2 whitespace-pre-wrap">{q.prompt}</div>
              <textarea className="input min-h-[120px]" value={answers[q.id]||''} onChange={(e)=>setAnswer(q.id, e.target.value)} />
            </div>
          ))}
          <button className="btn" onClick={onSubmit}>Submit Scenario</button>
        </div>

        <div>
          <h2 className="font-semibold mb-2">MCQ</h2>
          {mcqs.map(q => (
            <div key={q.id} className="card mb-4">
              <div className="font-semibold mb-1">{q.title} <span className="text-sm text-gray-500">({q.marks} marks)</span></div>
              <div className="mb-2 whitespace-pre-wrap">{q.prompt}</div>
              <div className="space-y-2">
                {q.options.map((opt, idx) => (
                  <label key={idx} className="flex items-center gap-2">
                    <input type="radio" name={`mcq-${q.id}`} checked={mcqSel[q.id]===idx} onChange={()=>setMcqSel({ ...mcqSel, [q.id]: idx })} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button className="btn" onClick={onSubmitMcq}>Submit MCQ</button>
        </div>

        <div className="md:col-span-2">
          <h2 className="font-semibold mb-2">Hands-on Lab Tasks</h2>
          {labTasks.map(t => (
            <div key={t.id} className="card mb-4">
              <div className="font-semibold mb-1">{t.title} <span className="text-sm text-gray-500">({t.marks} marks)</span></div>
              <div className="mb-2 whitespace-pre-wrap">{t.instructions}</div>
              {t.resource_url && (
                <button type="button" className="text-blue-600" onClick={()=>onDownloadResource(t)}>Download resource</button>
              )}
              <div className="mt-2 flex items-center gap-2">
                <input type="file" onChange={(e)=>setLabFiles({ ...labFiles, [t.id]: e.target.files?.[0] || null })} />
                <button className="btn" onClick={()=>onUploadLab(t.id)}>Upload</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
