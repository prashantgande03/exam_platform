import React from 'react'
import { useLocation, Link } from 'react-router-dom'

export default function Result() {
  const { state } = useLocation()
  const data = state || { total_score: 0, max_score: 0, breakdown: [] }
  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        <h1 className="text-xl font-semibold mb-2">Your Results</h1>
        <div className="mb-3">Total: <span className="font-mono">{data.total_score} / {data.max_score}</span></div>
        <div className="space-y-2">
          {data.breakdown.map((b,i)=> (
            <div key={i} className="border rounded p-2">
              <div className="font-semibold">Q{b.question_id}: {b.title}</div>
              <div>Score: {b.score} / {b.marks}</div>
            </div>
          ))}
        </div>
        <Link to="/exam" className="btn mt-4 inline-block">Back</Link>
      </div>
    </div>
  )
}
