import { z } from 'zod' // NOTE: this MUST be the same version of zod as mcp server sdk's zod dependency, or there may be a typescript error
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
// import jwt, { JwtHeader, SigningKeyCallback } from "jsonwebtoken";
// import jwksClient from "jwks-rsa";
import { config } from '../config'
import logger from '../logger'

const skyfireSellerApiKey = config.get('skyfireSellerApiKey')
const keycloakUrl = config.get('keycloakUrl')
const keycloakGrantType = config.get('keycloakGrantType')
const keycloakSubjectTokenType = config.get('keycloakSubjectTokenType')
const keycloakSubjectIssuer = config.get('keycloakSubjectIssuer')
const keycloakClientId = config.get('keycloakClientId')
const keycloakClientSecret = config.get('keycloakClientSecret')
const datasetBaseUrl =
  'https://pub-303d212fa4df4073b8b38b3de4a72d89.r2.dev/Dappier'

// Each field falls back to undefined on its own, so one malformed field (e.g.
// `"error_description": null`) doesn't discard the others.
const tokenResponseSchema = z.object({
  access_token: z.string().min(1).optional().catch(undefined),
  error: z.string().optional().catch(undefined),
  error_description: z.string().optional().catch(undefined)
})

type TokenResponse = z.infer<typeof tokenResponseSchema>

function toolError(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}

// Keycloak (or a proxy in front of it) can answer with a body that isn't the
// expected JSON, e.g. an HTML 502; treat that as a failed exchange.
function parseTokenResponse(body: string): TokenResponse {
  try {
    const result = tokenResponseSchema.safeParse(JSON.parse(body))

    return result.success ? result.data : {}
  } catch {
    return {}
  }
}

async function requestTokenExchange(
  kyaToken: string
): Promise<{ status: number; body: string }> {
  const response = await fetch(keycloakUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: keycloakGrantType,
      subject_token: kyaToken,
      subject_token_type: keycloakSubjectTokenType,
      client_id: keycloakClientId,
      client_secret: keycloakClientSecret,
      subject_issuer: keycloakSubjectIssuer
    }).toString()
  })
  const body = await response.text()

  return { status: response.status, body }
}

const createAccountAndLoginWithKeycloak = async (
  kyaToken: string
): Promise<CallToolResult> => {
  let exchange: { status: number; body: string }

  try {
    exchange = await requestTokenExchange(kyaToken)
  } catch (error) {
    logger.error({ err: error }, 'Keycloak token exchange request failed')

    return toolError('Keycloak token exchange failed: Keycloak is unreachable')
  }

  const authRes = parseTokenResponse(exchange.body)

  if (authRes.access_token === undefined) {
    logger.error(
      {
        status: exchange.status,
        error: authRes.error,
        errorDescription: authRes.error_description
      },
      'Keycloak token exchange failed'
    )

    return toolError(
      `Keycloak token exchange failed (HTTP ${exchange.status}): ${authRes.error ?? 'unknown error'} — ${authRes.error_description ?? 'no description'}`
    )
  }

  return {
    content: [
      {
        type: 'text',
        text: `Account created. Access token is ${authRes.access_token}`
      }
    ]
  }
}

export class DappierMCP {
  readonly server = new McpServer(
    {
      name: 'dappier-mcp-server-v1',
      version: '0.0.1'
    },
    {
      capabilities: {
        resources: {},
        tools: {}
      }
    }
  )
  // withAuth(handler: (args: any, extra?: any) => Promise<any>) {
  //     return async (args: any, extra?: any) => {
  //       const { accessToken } = args;

  //       const validation = await validateKeycloakToken(accessToken);

  //       if (!validation.valid) {
  //         return {
  //           content: [
  //             {
  //               type: "text" as const,
  //               text: `Unauthorized: ${validation.reason}`,
  //             },
  //           ],
  //         };
  //       }

  //       return await handler(args, extra);
  //     };
  //   }

  // Initialize mock data
  dataset = {
    id: 1,
    sellerId: 1,
    skyfireReceiverUsername: 'Dappier',
    data: [
      {
        id: 1,
        dataId: 1,
        title: 'US Automobile Data - 2024',
        size: '20MB',
        description: 'Data specifically for the year of 2024.',
        price: '0.002',
        sampleDataFormat: {
          type: 'csv',
          headers: 'Manufacturer,Model,Month,Unit Sales'
        },
        dataUrl: `${datasetBaseUrl}/demo-dataset1.csv`
      },
      {
        id: 2,
        dataId: 2,
        title: 'US Automobile Data - 2025',
        size: '10MB',
        description: 'Data specifically for the year of 2025.',
        price: '0.001',
        sampleDataFormat: {
          type: 'csv',
          headers: 'Manufacturer,Model,Month,Unit Sales'
        },
        dataUrl: `${datasetBaseUrl}/demo-dataset2.csv`
      }
    ]
  }

  constructor() {
    this.init()
  }

  init(): void {
    this.server.registerResource('guide', 'mcp://guide', {}, async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: `This is the Dappier Keycloak MCP server. 
            In order to access the tools of this server, an agent must create an account and login with Dappier using the create-account-and-login tool. 
            Using this tool will give you an access token which you must pass for other Dappier tool calls for them to be authenticated. 
            The tools of this server are:
            search-dataset: returns the list of datasets matching the input prompt. Each dataset has dataset_id which could be further used in other tools
            get-pricing: gets pricing for the dataset_id provided
            download-dataset: returns the dataset url for the selected dataset_id
            The pricing from the Skyfire seller service is just for reference and not the actual pricing. You must call the get-pricing tool to find out the specific price of the 
            dataset you want to acquire. Always remember to call the get-pricing tool before making a payment token to this service. 
            The service accepts Skyfire PAY / KYA+PAY tokens to complete the payment transaction.
        `
        }
      ]
    }))
    this.server.registerTool(
      'create-account-and-login',
      {
        description: `Having an account with Dappier is mandatory to access its tools. This tool creates account for current buyer agent 
      using the KYA token generated by Skyfire. On successful account creation, access token is returned`,
        inputSchema: {
          kyaToken: z.string().describe(
            `KYA token generated by Skyfire to be used by 
            Dappier for account creation`
          )
        }
      },
      async ({ kyaToken }) => createAccountAndLoginWithKeycloak(kyaToken)
    )

    this.server.registerTool(
      'search-dataset',
      {
        description: `Access token is mandatory to access this tool. This tool returns the list of datasets matching the input prompt. 
      Each dataset has dataset_id which could be further used in other tools`,
        inputSchema: {
          inputPrompt: z
            .string()
            .describe('Input prompt for searching dataset'),
          accessToken: z
            .string()
            .describe('Access token required to access and execute this tool')
        }
      },
      // this.withAuth(
      async ({ accessToken }) => {
        const intro = `Following is the comma separated list of data available from seller ${this.dataset.skyfireReceiverUsername}. 
          Each entry has an id, title and size associated.`
        const rows = this.dataset.data
          .map(
            (item) =>
              `${item.id}, ${item.title}, ${item.size}, ${item.sampleDataFormat.headers}\n`
          )
          .join('')

        return {
          content: [
            {
              type: 'text' as const,
              text: `${intro}${rows}\nYour accessToken - ${accessToken} is verified`
            }
          ]
        }
      }
      // )
    )

    this.server.registerTool(
      'get-pricing',
      {
        description: `Access token is mandatory to access this tool. 
      This tool gets pricing for the dataset_id provided`,
        inputSchema: {
          accessToken: z
            .string()
            .describe('Access token required to access and execute this tool'),
          datasetId: z.number().describe('ID for chosen dataset')
        }
      },
      // this.withAuth(
      async ({ accessToken, datasetId }) => {
        const selected = this.dataset.data.find(
          (data) => data.dataId === datasetId
        )

        if (selected === undefined) {
          return toolError(`Dataset ${datasetId} not found`)
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `Pricing for selected dataset ${datasetId} is ${selected.price}. Your accessToken - ${accessToken} is verified`
            }
          ]
        }
      }
      // )
    )

    this.server.registerTool(
      'download-dataset',
      {
        description: `Access token is mandatory to access this tool. 
      Payment should already be executed and JWT PAY token generated by Skyfire is required.
      This tool returns the dataset url for the selected dataset_id`,
        inputSchema: {
          accessToken: z
            .string()
            .describe('Access token required to access and execute this tool'),
          datasetId: z.number().describe('ID for chosen dataset'),
          payToken: z.string().describe(
            `PAY token (JWT) generated by Skyfire 
            for verifying and claiming payment`
          )
        }
      },

      // this.withAuth(
      async ({ accessToken, datasetId, payToken }) => {
        const currentDataset = this.dataset.data.find(
          (data) => data.dataId === datasetId
        )

        if (currentDataset === undefined) {
          return toolError(`Dataset ${datasetId} not found`)
        }

        const chargeAmount = currentDataset.price

        const response = await fetch(
          `${config.get('apiHost')}/api/v1/tokens/charge`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'skyfire-api-key': skyfireSellerApiKey
            },
            body: JSON.stringify({
              token: payToken,
              chargeAmount
            })
          }
        )

        const res = (await response.json()) as {
          amountCharged: string
          remainingBalance: string
        }

        if (res.amountCharged === chargeAmount) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Purchased dataset ${datasetId}. Download from ${currentDataset.dataUrl}. Your accessToken - ${accessToken} is verified`
              }
            ]
          }
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `Unable to complete transaction. Contact us for more details.`
            }
          ]
        }
      }
      // )
    )
  }
}
