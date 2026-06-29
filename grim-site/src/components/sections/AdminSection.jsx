import { useCallback, useEffect, useState } from 'react'
import { Construction, Cpu, Network, Server, Users } from 'lucide-react'
import { TerminalIcon } from '../common/TerminalIcon.jsx'
import { SectionTitle } from '../common/SectionTitle.jsx'
import { UserManager } from './UserManager.jsx'
import { TwitchSettings } from './TwitchSettings.jsx'
import { useAuth } from '../../auth/context.js'
import { listUsers } from '../../lib/authApi.js'
import { services } from '../../data/services.js'

export function AdminSection() {
  const { user } = useAuth()
  const [users, setUsers] = useState(null)

  // The registry is the source of truth for both the operator metric and the
  // user-manager table, so it lives here and reloads after every mutation.
  const loadUsers = useCallback(
    () => listUsers().then(setUsers, () => setUsers([])),
    [],
  )

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const operatorCount = users === null ? null : users.length

  const metrics = [
    {
      id: 'operators',
      icon: Users,
      label: 'Operators',
      value: operatorCount === null ? '··' : String(operatorCount),
      meta: 'accounts on file',
    },
    {
      id: 'session',
      icon: Cpu,
      label: 'Session',
      value: user?.username ?? 'admin',
      meta: 'signed-in admin',
    },
    {
      id: 'services',
      icon: Server,
      label: 'Services',
      value: `${services.length} online`,
      meta: 'converter endpoints',
    },
    {
      id: 'miner',
      icon: Network,
      label: 'Miner',
      value: 'linked',
      meta: 'grimnetwork node',
    },
  ]

  return (
    <section className="section admin" id="admin">
      <SectionTitle>Admin</SectionTitle>

      <p className="admin-status" role="status">
        <TerminalIcon icon={Construction} label="" />
        <span className="admin-status-dot" aria-hidden="true">●</span>
        dashboard under construction — operator registry is live, more panels ship next.
      </p>

      <div className="admin-metrics">
        {metrics.map((metric) => (
          <article className="admin-card" key={metric.id}>
            <span className="admin-card-label">
              <TerminalIcon icon={metric.icon} label="" />
              {metric.label}
            </span>
            <span className="admin-card-value">{metric.value}</span>
            <span className="admin-card-meta">{metric.meta}</span>
          </article>
        ))}
      </div>

      <div className="admin-board">
        <UserManager
          users={users}
          currentUsername={user?.username}
          onChange={loadUsers}
        />
        <TwitchSettings />
      </div>
    </section>
  )
}
