import { useEffect, useState } from 'react'
import {
  createGroup,
  fetchSummary,
  getMyGroup,
  getMyProfile,
  joinGroup,
  leaveGroup,
  setDisplayName,
  type Group as GroupT,
  type MemberSummary,
} from '../store/groupsClient'

export function Group() {
  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<GroupT | null>(null)
  const [members, setMembers] = useState<MemberSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [myName, setMyName] = useState('')
  const [needsName, setNeedsName] = useState(false)

  async function refresh() {
    setError(null)
    try {
      const profile = await getMyProfile()
      setMyName(profile?.display_name ?? '')
      setNeedsName(!profile)
      const g = await getMyGroup()
      setGroup(g)
      setMembers(g ? await fetchSummary(g.id) : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function act(fn: () => Promise<unknown>) {
    setError(null)
    try {
      await fn()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  if (loading) return <div className="page page-narrow"><p className="muted">Loading…</p></div>

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>Group</h1>
      </div>

      {error && <p role="alert" className="section-note" style={{ color: 'crimson' }}>{error}</p>}

      <div className="panel">
        <h2>Your display name</h2>
        <div className="row wrap" style={{ gap: 10 }}>
          <input
            value={myName}
            placeholder="How you appear to the group"
            onChange={(e) => setMyName(e.target.value)}
          />
          <button
            className="btn"
            disabled={!myName.trim()}
            onClick={() => void act(() => setDisplayName(myName.trim()))}
          >
            Save name
          </button>
        </div>
        {needsName && <p className="section-note">Set a display name so your partner can recognise you.</p>}
      </div>

      {!group ? (
        <>
          <div className="panel">
            <h2>Create a group</h2>
            <div className="row wrap" style={{ gap: 10 }}>
              <input value={name} placeholder="Group name" onChange={(e) => setName(e.target.value)} />
              <button
                className="btn primary"
                disabled={!name.trim()}
                onClick={() => void act(() => createGroup(name.trim()))}
              >
                Create
              </button>
            </div>
          </div>
          <div className="panel">
            <h2>Join a group</h2>
            <div className="row wrap" style={{ gap: 10 }}>
              <input value={code} placeholder="Invite code" onChange={(e) => setCode(e.target.value)} />
              <button
                className="btn"
                disabled={!code.trim()}
                onClick={() => void act(() => joinGroup(code.trim()))}
              >
                Join
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="panel">
            <h2>{group.name}</h2>
            <p className="muted">
              Invite code: <code>{group.invite_code}</code> — share it to add someone.
            </p>
            <button className="btn danger" onClick={() => void act(() => leaveGroup())}>
              Leave group
            </button>
          </div>
          <div className="panel">
            <h2>Accountability</h2>
            {members.length === 0 ? (
              <p className="muted">No members yet.</p>
            ) : (
              <div className="row wrap" style={{ gap: 12 }}>
                {members.map((m) => (
                  <div key={m.user_id} className="panel" style={{ minWidth: 160 }}>
                    <h3 style={{ marginTop: 0 }}>{m.display_name}</h3>
                    <p className="muted">Applied this week: {m.applied_this_week}</p>
                    <p className="muted">Active: {m.active}</p>
                    <p className="muted">Overdue follow-ups: {m.overdue}</p>
                    <p className="muted">Interviews: {m.interviews}</p>
                    <p className="muted">Offers: {m.offers}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
