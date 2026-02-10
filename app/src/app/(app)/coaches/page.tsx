'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const divisions = ['ALL', 'FBS', 'FCS', 'DII', 'DIII', 'JUCO', 'NAIA']

interface Program {
  id: string
  school_name: string
  division: string
  conference: string
  state: string
  logo_url: string | null
  coaches: { count: number }[]
}

interface Coach {
  id: string
  first_name: string
  last_name: string
  title: string
  email: string
  twitter_handle: string
  twitter_dm_open: boolean
  program_id: string
  programs: { school_name: string; logo_url: string | null } | null
}

type SortKey = 'school_name' | 'division' | 'conference' | 'state'
type CoachSortKey = 'name' | 'school' | 'title'

export default function CoachesPage() {
  const [activeDivision, setActiveDivision] = useState('ALL')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'programs' | 'coaches'>('programs')
  const [programs, setPrograms] = useState<Program[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('school_name')
  const [coachSortKey, setCoachSortKey] = useState<CoachSortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<string | null>(null)
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setLoading(true)
    // Fetch programs with coach count
    let pQuery = supabase.from('programs').select('id, school_name, division, conference, state, logo_url, coaches(count)')
    if (activeDivision !== 'ALL') pQuery = pQuery.eq('division', activeDivision)
    if (search) pQuery = pQuery.or(`school_name.ilike.%${search}%,state.ilike.%${search}%,conference.ilike.%${search}%`)
    const { data: pData } = await pQuery
    setPrograms((pData as unknown as Program[]) || [])

    // Fetch coaches
    let cQuery = supabase.from('coaches').select('id, first_name, last_name, title, email, twitter_handle, twitter_dm_open, program_id, programs(school_name, logo_url)')
    if (activeDivision !== 'ALL') cQuery = cQuery.eq('programs.division', activeDivision)
    if (search) cQuery = cQuery.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,programs.school_name.ilike.%${search}%`)
    const { data: cData } = await cQuery
    setCoaches((cData as unknown as Coach[]) || [])
    setLoading(false)
  }, [activeDivision, search, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const addToPipeline = async (programId: string) => {
    setAdding(programId)
    const { data: stages } = await supabase.from('pipeline_stages').select('id').order('order_index').limit(1)
    if (stages && stages.length > 0) {
      await supabase.from('pipeline_entries').insert({ program_id: programId, stage_id: stages[0].id })
    }
    setAdding(null)
    alert('Added to pipeline!')
  }

  const sortedPrograms = [...programs].sort((a, b) => {
    const av = String(a[sortKey as keyof Program] || '')
    const bv = String(b[sortKey as keyof Program] || '')
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
  })

  const sortedCoaches = [...coaches].sort((a, b) => {
    let av = '', bv = ''
    if (coachSortKey === 'name') { av = `${a.last_name} ${a.first_name}`; bv = `${b.last_name} ${b.first_name}` }
    else if (coachSortKey === 'school') { av = (a.programs as { school_name: string } | null)?.school_name || ''; bv = (b.programs as { school_name: string } | null)?.school_name || '' }
    else { av = a.title || ''; bv = b.title || '' }
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
  })

  const handleProgramSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  const handleCoachSort = (key: CoachSortKey) => {
    if (coachSortKey === key) setSortAsc(!sortAsc)
    else { setCoachSortKey(key); setSortAsc(true) }
  }

  const SortIcon = ({ active, asc }: { active: boolean; asc: boolean }) => (
    <span className="ml-1 text-xs">{active ? (asc ? '▲' : '▼') : '⇅'}</span>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Coach Database</h1>
        <p className="text-gray-500 mt-1">Browse programs and coaching staff</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
          {divisions.map(d => (
            <button key={d} onClick={() => setActiveDivision(d)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                activeDivision === d ? 'bg-[#0047AB] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}>
              {d}
            </button>
          ))}
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search coaches, schools, states..."
          className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0047AB] focus:border-transparent outline-none text-sm" />
        <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
          <button onClick={() => setView('programs')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${view === 'programs' ? 'bg-[#0047AB] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            Programs
          </button>
          <button onClick={() => setView('coaches')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${view === 'coaches' ? 'bg-[#0047AB] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            Coaches
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : view === 'programs' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {([['school_name', 'School'], ['division', 'Division'], ['conference', 'Conference'], ['state', 'State']] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-gray-900 select-none" onClick={() => handleProgramSort(key)}>
                    {label}<SortIcon active={sortKey === key} asc={sortAsc} />
                  </th>
                ))}
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Coaches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedPrograms.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium flex items-center gap-2">
                    {p.logo_url ? <img src={p.logo_url} alt={p.school_name} className="w-6 h-6 object-contain" /> : null}
                    {p.school_name}
                  </td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-blue-100 text-[#0047AB] text-xs font-medium rounded-full">{p.division}</span></td>
                  <td className="px-4 py-3 text-gray-600">{p.conference}</td>
                  <td className="px-4 py-3 text-gray-600">{p.state}</td>
                  <td className="px-4 py-3 text-gray-600">{p.coaches?.[0]?.count ?? 0}</td>
                </tr>
              ))}
              {sortedPrograms.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No programs found</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleCoachSort('name')}>Name<SortIcon active={coachSortKey === 'name'} asc={sortAsc} /></th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleCoachSort('school')}>School<SortIcon active={coachSortKey === 'school'} asc={sortAsc} /></th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer select-none" onClick={() => handleCoachSort('title')}>Title<SortIcon active={coachSortKey === 'title'} asc={sortAsc} /></th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">X Handle</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">DM</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedCoaches.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.first_name} {c.last_name}</td>
                  <td className="px-4 py-3 text-gray-600 flex items-center gap-2">
                    {(c.programs as { school_name: string; logo_url: string | null } | null)?.logo_url ? <img src={(c.programs as { school_name: string; logo_url: string | null } | null)!.logo_url!} alt="" className="w-5 h-5 object-contain" /> : null}
                    {(c.programs as { school_name: string; logo_url: string | null } | null)?.school_name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.title}</td>
                  <td className="px-4 py-3">{c.twitter_handle ? <a href={`https://twitter.com/${c.twitter_handle.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="text-[#0047AB] hover:underline">{c.twitter_handle}</a> : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${c.twitter_dm_open ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.twitter_dm_open ? 'open' : 'unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{c.email || '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => addToPipeline(c.program_id)} disabled={adding === c.program_id}
                      className="px-3 py-1 text-xs font-medium bg-[#E31937] text-white rounded-md hover:bg-[#c91530] transition disabled:opacity-50">
                      {adding === c.program_id ? '...' : '+ Pipeline'}
                    </button>
                  </td>
                </tr>
              ))}
              {sortedCoaches.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No coaches found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
