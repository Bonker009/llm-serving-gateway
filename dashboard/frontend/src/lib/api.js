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
