// Same-origin API client for the LiteLLM gateway admin backend.
// The page sits behind HTTP Basic auth, so the browser attaches credentials
// automatically; we fetch normally and surface errors to the caller.

async function request(path) {
  let res
  try {
    res = await fetch(path, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    })
  } catch (err) {
    throw new Error('Network error — could not reach the backend.')
  }

  if (res.status === 401) {
    throw new Error('Unauthorized (401). Your session may have expired.')
  }
  if (!res.ok) {
    throw new Error(`Request failed (${res.status} ${res.statusText}).`)
  }

  try {
    return await res.json()
  } catch (err) {
    throw new Error('Received a malformed response from the backend.')
  }
}

// Shared JSON POST helper for all write/management endpoints.
async function post(path, body) {
  let res
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body || {}),
    })
  } catch (err) {
    throw new Error('Network error — could not reach the backend.')
  }

  if (res.status === 401) {
    throw new Error('Unauthorized (401). Your session may have expired.')
  }
  if (!res.ok) {
    let detail = ''
    try {
      const data = await res.json()
      detail = data?.detail || data?.message || ''
    } catch (e) {
      /* ignore malformed error body */
    }
    throw new Error(detail || `Request failed (${res.status} ${res.statusText}).`)
  }

  try {
    return await res.json()
  } catch (err) {
    return null
  }
}

export function getHealth() {
  return request('/api/health')
}

export function getTeams() {
  return request('/api/teams')
}

export function getLogs(days = 7, limit = 1000) {
  const d = [1, 7, 30].includes(Number(days)) ? Number(days) : 7
  return request(`/api/logs?days=${d}&limit=${limit}`)
}

export function getModels() {
  return request('/api/models')
}

// Slow — pings every configured backend. Call on demand only, never in the
// global fetch loop.
export function getModelHealth() {
  return request('/api/model-health')
}

export function getKeys() {
  return request('/api/keys')
}

// Live host metrics (GPU, CPU, memory, disk, processes, users). Reads the host
// through mounts configured on the dashboard container; on demand only.
export function getServerStats() {
  return request('/api/server')
}

// Teams
export function createTeam(body) {
  return post('/api/teams/create', body)
}
export function updateTeam(body) {
  return post('/api/teams/update', body)
}
export function deleteTeam(body) {
  return post('/api/teams/delete', body)
}

// Keys
export function createKey(body) {
  return post('/api/keys/create', body)
}
export function updateKey(body) {
  return post('/api/keys/update', body)
}
export function deleteKey(body) {
  return post('/api/keys/delete', body)
}

// Models
export function createModel(body) {
  return post('/api/models/create', body)
}
export function updateModel(body) {
  return post('/api/models/update', body)
}
export function deleteModel(body) {
  return post('/api/models/delete', body)
}

export async function runTest(body) {
  let res
  try {
    res = await fetch('/api/test', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new Error('Network error — could not reach the backend.')
  }

  if (res.status === 401) {
    throw new Error('Unauthorized (401). Your session may have expired.')
  }
  if (!res.ok) {
    throw new Error(`Request failed (${res.status} ${res.statusText}).`)
  }

  try {
    return await res.json()
  } catch (err) {
    throw new Error('Received a malformed response from the backend.')
  }
}
