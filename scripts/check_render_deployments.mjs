#!/usr/bin/env node
import process from 'process'

const API_BASE = 'https://api.render.com/v1'

function getEnvOrArg(name, index) {
  const value = process.env[name]
  if (value) return value
  return process.argv[index]
}

const RENDER_API_KEY = getEnvOrArg('RENDER_API_KEY', 2)
const SERVICE_ID = getEnvOrArg('RENDER_SERVICE_ID', 3)
const LIMIT = Number(process.env.RENDER_DEPLOY_LIMIT || process.argv[4] || 20)

if (!RENDER_API_KEY || !SERVICE_ID) {
  console.error('Usage: RENDER_API_KEY=<key> RENDER_SERVICE_ID=<service-id> node scripts/check_render_deployments.mjs')
  process.exit(1)
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${RENDER_API_KEY}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Render API error ${response.status}: ${body}`)
  }

  return response.json()
}

function prettyDuration(startedAt, endedAt) {
  if (!startedAt) return 'unknown'
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  const delta = Math.max(0, end - start)
  const seconds = Math.floor(delta / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

function summarizeDeploy(deploy) {
  return {
    id: deploy.id,
    status: deploy.state || deploy.status || 'unknown',
    reason: deploy.reason || deploy.message || 'no reason',
    commit: deploy.commit || deploy.branch || 'unknown',
    createdAt: deploy.createdAt || deploy.created_at || 'unknown',
    startedAt: deploy.startedAt || deploy.started_at || null,
    endedAt: deploy.finishedAt || deploy.finished_at || null,
    duration: prettyDuration(deploy.startedAt || deploy.started_at, deploy.finishedAt || deploy.finished_at),
    url: deploy.service ? `${deploy.service.name} (${deploy.id})` : deploy.id,
  }
}

function printNotice(failedDeploys) {
  console.log('Render deployment connectivity check:')
  console.log(`Service ID: ${SERVICE_ID}`)
  console.log(`Checked last ${LIMIT} deployments\n`)

  if (failedDeploys.length === 0) {
    console.log('✅ No failed deployments were found.')
    return
  }

  console.warn(`⚠️ ${failedDeploys.length} failed deployment(s) detected:`)
  for (const deploy of failedDeploys) {
    console.warn('---')
    console.warn(`ID: ${deploy.id}`)
    console.warn(`Status: ${deploy.status}`)
    console.warn(`Reason: ${deploy.reason}`)
    console.warn(`Commit / Branch: ${deploy.commit}`)
    console.warn(`Created: ${deploy.createdAt}`)
    console.warn(`Duration: ${deploy.duration}`)
  }
}

async function main() {
  try {
    const deploys = await fetchJson(`${API_BASE}/services/${SERVICE_ID}/deploys?limit=${LIMIT}`)

    if (!Array.isArray(deploys)) {
      throw new Error('Invalid Render response: expected an array of deploys')
    }

    const failed = deploys
      .map(summarizeDeploy)
      .filter(d => ['failed', 'cancelled', 'canceled', 'error', 'failed_with_errors'].includes(d.status.toLowerCase()))

    printNotice(failed)
    process.exit(failed.length > 0 ? 1 : 0)
  } catch (error) {
    console.error('Error connecting to Render API:')
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(2)
  }
}

main()
