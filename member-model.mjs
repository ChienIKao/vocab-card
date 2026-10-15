export function memberRows(requests, memberships, currentUid) {
  const rows = new Map(requests.map(request => [request.uid, {
    uid: request.uid, email: request.email, displayName: request.displayName
  }]));
  for (const member of memberships) {
    rows.set(member.uid, { ...rows.get(member.uid), uid: member.uid, enabled: member.enabled === true });
  }
  return [...rows.values()].map(row => ({
    ...row,
    self: row.uid === currentUid,
    status: row.enabled === true ? 'active' : row.enabled === false ? 'disabled' : 'pending'
  })).sort((a, b) => (a.email || a.uid).localeCompare(b.email || b.uid));
}

export function filterMembers(rows, filter, search) {
  const term = search.trim().toLocaleLowerCase();
  return rows.filter(row => (filter === 'all' || row.status === filter)
    && `${row.email || ''} ${row.displayName || ''} ${row.uid}`.toLocaleLowerCase().includes(term));
}
