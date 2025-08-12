import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store'
import { api, getResults, getResultsCsv } from '../services/api'

export default function Admin() {
  const { token, role } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', prompt: '', expected_answer: '', marks: 1 })
  const [list, setList] = useState([])
  const [results, setResults] = useState([])
  const [answers, setAnswers] = useState([])

  useEffect(() => { if (!token || role !== 'admin') navigate('/login') }, [token, role])

  const load = async () => {
    const { data } = await api.get('/questions') // list active
    setList(data)
  const res = await getResults()
  setResults(res)
  const { data: ans } = await api.get('/admin/answers')
  setAnswers(ans)
  }
  useEffect(() => { load() }, [])

  const save = async (e) => {
    e.preventDefault()
    await api.post('/questions', form)
    setForm({ title: '', prompt: '', expected_answer: '', marks: 1 })
    await load()
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="card">
        <h2 className="font-semibold mb-3">Create Question</h2>
        <form className="space-y-2" onSubmit={save}>
          <input className="input" placeholder="Title" value={form.title} onChange={(e)=>setForm({...form, title:e.target.value})} required />
          <textarea className="input min-h-[100px]" placeholder="Prompt" value={form.prompt} onChange={(e)=>setForm({...form, prompt:e.target.value})} required />
          <textarea className="input min-h-[100px]" placeholder="Expected Answer" value={form.expected_answer} onChange={(e)=>setForm({...form, expected_answer:e.target.value})} required />
          <input className="input" type="number" min="0" step="0.5" placeholder="Marks" value={form.marks} onChange={(e)=>setForm({...form, marks:parseFloat(e.target.value)})} />
          <button className="btn">Save</button>
        </form>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Active Questions</h2>
        <ul className="space-y-2">
          {list.map(q => (
            <li key={q.id} className="border rounded p-2">
              <div className="font-semibold">{q.title} <span className="text-xs text-gray-500">({q.marks} marks)</span></div>
              <div className="text-sm text-gray-600">{q.prompt.slice(0,120)}{q.prompt.length>120?'…':''}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card md:col-span-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Results</h2>
          <button className="btn" onClick={getResultsCsv}>Download CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">Username</th>
                <th className="p-2">Total</th>
                <th className="p-2">Max</th>
                <th className="p-2">When</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r,i)=> (
                <tr key={i} className="border-b">
                  <td className="p-2">{r.username}</td>
                  <td className="p-2">{r.total_score}</td>
                  <td className="p-2">{r.max_score}</td>
                  <td className="p-2">{r.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card md:col-span-2">
        <h2 className="font-semibold mb-2">Answers</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">User</th>
                <th className="p-2">Question</th>
                <th className="p-2">Response</th>
                <th className="p-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {answers.map((a,i)=> (
                <tr key={i} className="border-b align-top">
                  <td className="p-2 whitespace-nowrap">{a.username}</td>
                  <td className="p-2">{a.title} <span className="text-xs text-gray-500">(Q{a.question_id})</span></td>
                  <td className="p-2 max-w-xl"><div className="whitespace-pre-wrap">{a.response}</div></td>
                  <td className="p-2 whitespace-nowrap">{a.score} / {a.marks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
