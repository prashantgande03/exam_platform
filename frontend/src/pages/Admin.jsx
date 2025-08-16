import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store'
import { api, getResults, getResultsCsv, createMcq, listMcq, createLabTask, listLabTasks, listLabSubmissions, scoreLabSubmission, API_BASE } from '../services/api'

export default function Admin() {
  const { token, role } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', prompt: '', expected_answer: '', marks: 1 })
  const [mcqForm, setMcqForm] = useState({ title: '', prompt: '', options: ['', '', '', ''], correct_index: 0, marks: 1 })
  const [labForm, setLabForm] = useState({ title: '', instructions: '', marks: 5, is_active: true, resource: null })
  const [list, setList] = useState([])
  const [mcqList, setMcqList] = useState([])
  const [labList, setLabList] = useState([])
  const [results, setResults] = useState([])
  const [userAnsList, setUserAnsList] = useState([])
  const [answers, setAnswers] = useState([])
  const [subs, setSubs] = useState([])

  useEffect(() => { console.log('token:', token, 'role:', role) 
    if (!token || role !== 'admin') navigate('/login') }, [token, role])

  const load = async () => {
    const { data } = await api.get('/questions')
    setList(data)
    setMcqList(await listMcq())
    setLabList(await listLabTasks())
    const res = await getResults()
    setResults(res)
    const { data: ans } = await api.get('/admin/answers')
    setAnswers(ans)
    setSubs(await listLabSubmissions())
    const { data: userAns } = await api.get('/admin/userans')
    setUserAnsList(userAns)
  }
  useEffect(() => { load() }, [])

  const save = async (e) => {
    e.preventDefault()
    await api.post('/questions', form)
    setForm({ title: '', prompt: '', expected_answer: '', marks: 1 })
    await load()
  }

  const saveMcq = async (e) => {
    e.preventDefault()
    await createMcq(mcqForm)
    setMcqForm({ title: '', prompt: '', options: ['', '', '', ''], correct_index: 0, marks: 1 })
    await load()
  }

  const saveLab = async (e) => {
    e.preventDefault()
    const fd = new FormData()
    fd.append('title', labForm.title)
    fd.append('instructions', labForm.instructions)
    fd.append('marks', String(labForm.marks))
    fd.append('is_active', String(labForm.is_active))
    if (labForm.resource) fd.append('resource', labForm.resource)
    await createLabTask(fd)
    setLabForm({ title: '', instructions: '', marks: 5, is_active: true, resource: null })
    await load()
  }

  const downloadResource = async (task) => {
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

  const downloadSubmission = async (sub) => {
    try {
      const url = `${API_BASE}/lab/submissions/${sub.id}/file`
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!resp.ok) throw new Error('Download failed')
      const blob = await resp.blob()
      const disp = resp.headers.get('content-disposition') || ''
      let filename = sub.upload_filename || 'submission'
      const match = /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i.exec(disp)
      if (match) filename = decodeURIComponent(match[1] || match[2])
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (e) {
      alert('Unable to download submission')
    }
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
        <h2 className="font-semibold mb-3">Create MCQ</h2>
        <form className="grid gap-2" onSubmit={saveMcq}>
          <input className="input" placeholder="Title" value={mcqForm.title} onChange={(e)=>setMcqForm({...mcqForm, title:e.target.value})} required />
          <textarea className="input" placeholder="Prompt" value={mcqForm.prompt} onChange={(e)=>setMcqForm({...mcqForm, prompt:e.target.value})} required />
          <div className="grid md:grid-cols-2 gap-2">
            {mcqForm.options.map((opt,idx)=> (
              <input key={idx} className="input" placeholder={`Option ${idx+1}`} value={opt} onChange={(e)=>{
                const opts=[...mcqForm.options]; opts[idx]=e.target.value; setMcqForm({...mcqForm, options:opts})
              }} />
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-2 items-center">
            <label className="text-sm">Correct Index (0-3)</label>
            <input className="input" type="number" min="0" max="3" value={mcqForm.correct_index} onChange={(e)=>setMcqForm({...mcqForm, correct_index:parseInt(e.target.value)})} />
            <input className="input" type="number" min="0" step="0.5" placeholder="Marks" value={mcqForm.marks} onChange={(e)=>setMcqForm({...mcqForm, marks:parseFloat(e.target.value)})} />
          </div>
          <button className="btn w-full">Save MCQ</button>
        </form>
        <div className="mt-3">
          <h3 className="font-semibold mb-2">MCQ List</h3>
          <ul className="space-y-2">
            {mcqList.map(q=> (
              <li key={q.id} className="border rounded p-2">
                <div className="font-semibold">{q.title} <span className="text-xs text-gray-500">({q.marks} marks)</span></div>
                <div className="text-sm text-gray-600">{q.prompt}</div>
                <ol className="list-decimal pl-6">
                  {q.options.map((o,i)=>(<li key={i}>{o}</li>))}
                </ol>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card md:col-span-2">
        <h2 className="font-semibold mb-3">Create Lab Task</h2>
        <form className="grid gap-2" onSubmit={saveLab}>
          <input className="input" placeholder="Title" value={labForm.title} onChange={(e)=>setLabForm({...labForm, title:e.target.value})} required />
          <textarea className="input" placeholder="Instructions" value={labForm.instructions} onChange={(e)=>setLabForm({...labForm, instructions:e.target.value})} required />
          <div className="grid md:grid-cols-3 gap-2 items-center">
            <input className="input" type="number" min="0" step="0.5" placeholder="Marks" value={labForm.marks} onChange={(e)=>setLabForm({...labForm, marks:parseFloat(e.target.value)})} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={labForm.is_active} onChange={(e)=>setLabForm({...labForm, is_active:e.target.checked})} /> Active</label>
            <input className="input" type="file" onChange={(e)=>setLabForm({...labForm, resource:e.target.files?.[0]||null})} />
          </div>
          <button className="btn w-full">Save Lab Task</button>
        </form>
        <div className="mt-3">
          <h3 className="font-semibold mb-2">Lab Tasks</h3>
          <ul className="space-y-2">
            {labList.map(t=> (
              <li key={t.id} className="border rounded p-2">
                <div className="font-semibold">{t.title} <span className="text-xs text-gray-500">({t.marks} marks)</span></div>
                <div className="text-sm whitespace-pre-wrap">{t.instructions}</div>
                {t.resource_url && (
                  <button type="button" className="text-blue-600" onClick={() => downloadResource(t)}>Download resource</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

  {/* <div className="card md:col-span-2">
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
      </div> */}

      {/* <div className="card md:col-span-2">
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
      </div> */}

      {/* <div className="card md:col-span-2">
        <h2 className="font-semibold mb-2">Lab Submissions</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">User</th>
                <th className="p-2">Task</th>
                <th className="p-2">File</th>
                <th className="p-2">Score</th>
                <th className="p-2">Status</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s)=> (
                <tr key={s.id} className="border-b">
                  <td className="p-2 whitespace-nowrap">{s.username}</td>
                  <td className="p-2 whitespace-nowrap">{s.task_title}</td>
                  <td className="p-2"><button className="text-blue-600" onClick={()=>downloadSubmission(s)}>Download</button></td>
                  <td className="p-2 whitespace-nowrap">{s.manual_score ?? '-'}</td>
                  <td className="p-2 whitespace-nowrap">{s.status}</td>
                  <td className="p-2">
                    <form className="flex gap-2 items-center" onSubmit={async (e)=>{e.preventDefault();
                      const score = parseFloat(e.currentTarget.score.value);
                      const feedback = e.currentTarget.feedback.value;
                      await scoreLabSubmission(s.id, { manual_score: score, feedback });
                      await load();
                    }}>
                      <input name="score" className="input w-24" type="number" min="0" step="0.5" placeholder="Score" />
                      <input name="feedback" className="input" placeholder="Feedback" />
                      <button className="btn">Save</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div> */}

     {/* User Answers Section */}
      <div className="card md:col-span-2">
        <h2 className="font-semibold mb-3">User Answers</h2>
        <ul className="space-y-2">
          {userAnsList.map(u => (
            <li key={u.id}>
              <button className="btn" onClick={() => navigate(`/admin/userans/${u.id}`)}>
                {u.username}
              </button>
            </li>
          ))}
          {userAnsList.length === 0 && <li className="text-gray-500">No user answers found.</li>}
        </ul>
      </div>
    </div>
  )
}
