import tracer, { TracerOptions } from 'dd-trace'
import { config } from './config'

export default tracer

if (config.get('datadog').enabled) {
  const gitCommit =
    process.env.DD_VERSION ??
    config.get('render').gitCommit ??
    process.env.GIT_COMMIT ??
    'unknown'

  const { statsdHost, logsInjection, service } = config.get('datadog')
  const options: TracerOptions = {
    env: config.get('appEnv'),
    service,
    hostname: statsdHost,
    logInjection: logsInjection,
    version: gitCommit,
    tags: {
      'git.commit.sha': gitCommit,
      'git.repository_url': 'github.com/skyfire-xyz/sky-mcp'
    }
  }

  tracer.use('openai')
  tracer.init(options)
}
