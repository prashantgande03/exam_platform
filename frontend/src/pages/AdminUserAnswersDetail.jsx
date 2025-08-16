import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../store'
import { api } from '../services/api'

export default function AdminUserAnswersDetail() {
  const { token, role } = useAuth()
  const { userId } = useParams()
  const [answers, setAnswers] = useState([])
  const [mcqAnswers, setMcqAnswers] = useState([])
  const [labSubs, setLabSubs] = useState([])


  useEffect(() => {
    api.get(`/admin/userans/${userId}`).then(({ data }) => setAnswers(data))
    api.get(`/admin/userans/${userId}/mcq`).then(({ data }) => setMcqAnswers(data))
    api.get(`/admin/userans/${userId}/labs`).then(({ data }) => setLabSubs(data))
  }, [userId])

    // CSV download handler
  const downloadCsv = () => {
    if (!answers.length) return
    const header = ['Question', 'Response', 'Score', 'Marks']
    const rows = answers.map(a =>
      [a.question_title, a.response, a.score, a.marks].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    )
    const csvContent = [header.join(','), ...rows].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const aTag = document.createElement('a')
    aTag.href = url
    aTag.download = `user_${userId}_answers.csv`
    document.body.appendChild(aTag)
    aTag.click()
    document.body.removeChild(aTag)
    URL.revokeObjectURL(url)
  }

  const downloadLabFile = (sub) => {
    api.downloadLabSubmissionFile(sub.id)
  }

return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Answers for User ID {userId}</h2>
        <button className="btn" onClick={downloadCsv}>Download CSV</button>
      </div>
      <table className="min-w-full text-sm mb-6">
        <thead>
          <tr>
            <th>Question</th>
            <th>Response</th>
            <th>Score</th>
            <th>Marks</th>
          </tr>
        </thead>
        <tbody>
          {answers.map((a, i) => (
            <tr key={i}>
              <td>{a.question_title}</td>
              <td>{a.response}</td>
              <td>{a.score}</td>
              <td>{a.marks}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <b><h2>mcqs</h2></b>
      <table className="min-w-full text-sm mb-6">
        <thead>
          <tr>
            <th>MCQ Question</th>
            <th>Selected Option</th>
            <th>Correct Option</th>
            <th>Score</th>
            <th>Marks</th>
          </tr>
        </thead>
        <tbody>
          {mcqAnswers.map((m, i) => (
            <tr key={i}>
              <td>{m.question_title}</td>
              <td>{m.selected_option}</td>
              <td>{m.correct_option}</td>
              <td>{m.score}</td>
              <td>{m.marks}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2><b>lab submission</b></h2>
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th>Lab Task</th>
            <th>Filename</th>
            <th>Status</th>
            <th>Score</th>
            <th>Download</th>
          </tr>
        </thead>
        
        <tbody>
          {labSubs.map((sub, i) => (
            <tr key={i}>
              <td>{sub.task_title}</td>
              <td>{sub.upload_filename}</td>
              <td>{sub.status}</td>
              <td>{sub.manual_score}</td>
              <td>
                <button className="btn" onClick={() => downloadLabFile(sub)}>
                  Download File
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

}