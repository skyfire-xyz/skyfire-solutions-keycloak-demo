import os from 'os'
import { AxiosError, isAxiosError } from 'axios'
import { Request } from 'express'
import { pinoHttp, Options as HttpOptions } from 'pino-http'
import pino, { Logger, LoggerOptions, Level, stdSerializers } from 'pino'
import { AppEnv, config } from './config'

export type LogLevel = Level

const appEnv = config.get('appEnv')

const getTransport = (): LoggerOptions['transport'] => {
  const mainTransport =
    appEnv === AppEnv.Dev || appEnv === AppEnv.Test
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      : {
          target: 'pino/file',
          options: { destination: '1' }
        }

  const datadog = config.get('datadog')
  if (datadog.apiKey) {
    return {
      targets: [
        mainTransport,
        {
          target: 'pino-datadog-transport',
          options: {
            ddClientConf: {
              authMethods: {
                apiKeyAuth: datadog.apiKey
              }
            },
            service: datadog.service,
            ddsource: datadog.source
          }
        }
      ]
    }
  }

  return mainTransport
}

const redact = {
  paths: [
    'req.cookie',
    'req.headers.cookie',
    'req.headers.authorization',
    'req.headers["skyfire-api-key"]',
    'req.headers["x-api-key"]',
    'req.body.data.client_secret',
    'jwt'
  ],
  censor: '**REDACTED**'
}

export function serializeAxiosError(err: AxiosError): Record<string, unknown> {
  const { config: axiosConfig, message, code, request } = err

  return {
    code,
    message,
    baseUrl: axiosConfig?.baseURL,
    path: axiosConfig?.url,
    method: axiosConfig?.method,
    requestHasBeenMade: request !== undefined
  }
}

function pinoErrorSerializer(err: unknown): unknown {
  if (!(err instanceof Error)) return err

  if (isAxiosError(err)) {
    const { type, message, stack } = stdSerializers.err(err)
    const serializedAxiosError = serializeAxiosError(err)
    return { type, message, stack, serializedAxiosError }
  }

  return stdSerializers.err(err)
}

export const logger: Logger = pino({
  level: config.get('logLevel'),
  transport: getTransport(),
  base: {
    env: config.get('appEnv'),
    pid: process.pid,
    hostname: os.hostname(),
    service: process.env.DD_SERVICE
  },
  redact,
  mixin(_mergeObject, level) {
    return {
      levelName: logger.levels.labels[level]
      // usr: getContextStoreUser()  // TODO fill in context from mcp server session info
    }
  },
  serializers: {
    err: pinoErrorSerializer,
    error: pinoErrorSerializer
  }
})

export default logger

const httpOptions: HttpOptions = {
  level: config.get('logLevel'),
  autoLogging: appEnv !== AppEnv.Test, // Disable request/response logging in test
  customReceivedMessage: (req) => {
    return `${req.method} ${req.url}`
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${(req as Request).originalUrl} ${res.statusCode}`
  },
  customErrorMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`
  },
  customLogLevel: (req, res) => {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn'
    }
    if (res.statusCode >= 500) {
      return 'error'
    }
    if (req?.url?.includes('health') === true) {
      return 'trace'
    }
    return 'info'
  },
  serializers: {
    err: stdSerializers.err,
    error: stdSerializers.err,
    req: (req) => {
      if (appEnv === AppEnv.Dev) {
        req.body = req.raw.body
      }
      return req
    }
  },
  transport: getTransport(),
  logger
}

export const httpLogger = pinoHttp({ ...httpOptions })
