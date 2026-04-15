import createClient from 'openapi-fetch'
import logger from '../../logger'
import { config } from '../../config'
import { DirectoryService } from 'src/types/schema'

interface ErrorResponse {
  code: string
  message: string
  // eslint-disable-next-line
  details?: { [key: string]: unknown }
}

// TODO: obtain this from sky-services swagger.json
interface ApiPaths {
  '/api/v1/directory/services': {
    get: {
      response: {
        200: {
          content: {
            'application/json': {
              services: [
                {
                  sellerServiceName: string
                  type: string
                  price: string
                  priceModel: string
                  sellerServiceDescription: string
                  sellerServiceId: string
                  minimumTokenAmount?: number
                  mcpServerUrl?: string
                  fetchAgentProfileUrl?: string
                  openapiSpecUrl?: string
                  websiteUrl?: string
                  termsOfServiceUrl?: string
                  identityRequirements: Record<
                    'individual' | 'business',
                    string[]
                  >
                  tags: string[]
                }
              ]
            }
          }
        }
      }
    }
  }
  '/api/v1/tokens': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            type: string
            buyerTag?: string
            sellerServiceId: string
            tokenAmount?: string
            expiresAt?: number
            identityPermissions?: string[]
          }
        }
      }
      responses: {
        200: {
          content: {
            'application/json': {
              token: string
            }
          }
        }
        400: {
          content: {
            'application/json': ErrorResponse
          }
        }
        402: {
          content: {
            'application/json': ErrorResponse
          }
        }
        404: {
          content: {
            'application/json': ErrorResponse
          }
        }
        500: {
          content: {
            'application/json': ErrorResponse
          }
        }
      }
    }
  }
}

const client = createClient<ApiPaths>({ baseUrl: config.get('apiHost') })

// export type getSellerResourceDataResponse = Awaited<
//   ReturnType<typeof _getSellerResourceData>
// >
export type createTokenResponse = Awaited<ReturnType<typeof _createToken>>

// Wrapper to apply inferred types from api spec

export async function getSellerResourceData()
// : Promise<getSellerResourceDataResponse> 
{
  // return await _getSellerResourceData()
  return {
            "id": "8a507c77-e2da-4847-b339-cca29576d55a",
            "name": "Dappier Keycloak",
            "description": "MCP server for dappier demo using Keycloak for authorizing MCP access. Make sure to use the get-pricing tool before you try and make payment tokens to this service (it will tell you the actual price of the data you need). Dappier is a vendor of live web data and datasets.",
            "tags": [],
            "type": "MCP_SERVER_LOCAL",
            "price": "0.0002",
            "priceModel": "PAY_PER_USE",
            "minimumTokenAmount": "0.0002",
            "humanIdentityRequirement": {
                "identityLevels": [],
                "organization": [],
                "individual": []
            },
            "seller": {
                "id": "786780c1-f413-43c9-bf7f-19e9e1ff00fc",
                "name": "Dappier"
            },
            "mcpServerUrl": "http://localhost:4002/mcp",
            "acceptedTokens": [
                "kya",
                "pay",
                "kya-pay"
            ],
            "createdAt": "2025-10-03T22:33:27.513Z",
            "updatedAt": "2025-10-07T17:32:47.392Z"
        }
}

export async function createToken(
  apiKey: string,
  type: string,
  sellerServiceId: string,
  buyerTag?: string,
  tokenAmount?: string,
  expiresAt?: number,
  identityPermissions?: string[]
): Promise<createTokenResponse> {
  return await _createToken(
    apiKey,
    type,
    buyerTag,
    sellerServiceId,
    tokenAmount,
    expiresAt,
    identityPermissions
  )
}

// async function _getSellerResourceData(): Promise<
//   DirectoryService[] | undefined
// > {
//   try {
//     logger.info('calling getSellerResourceData')
//     const result: {
//       data?: { data?: DirectoryService[] }
//     } = 
//     await client.GET('/api/v1/directory/services', {
//       headers: {
//         'Content-Type': 'application/json'
//       }
//     })

//     // Remove seller id from each service based on convo here https://skyfirexyz.slack.com/archives/C03H315UN68/p1757721429593199
//     if (result?.data?.data) {
//       result.data.data.forEach((r) => {
//         delete r.seller.id
//       })
//     }

//     logger.info('returning response for seller service resource data')
//     return result.data?.data
//   } catch (error) {
//     logger.info('error getting seller service resource data')
//     throw new Error('API Error', { cause: error })
//   }
// }

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function _createToken(
  apiKey: string,
  type: string,
  buyerTag: string | undefined,
  sellerServiceId: string,
  tokenAmount?: string,
  expiresAt?: number,
  identityPermissions?: string[]
) {
  logger.info(`apiKey ${apiKey}`);
  logger.info(`type ${type}`);
  logger.info(`sellerServiceId ${sellerServiceId}`);
  logger.info(`tokenAmount ${tokenAmount}`);
  logger.info(`expiresAt ${expiresAt}`);
  logger.info(`identityPermissions ${identityPermissions}`);
  try {
    logger.info('calling createToken')
    const result = await client.POST('/api/v1/tokens', {
      headers: {
        'Content-Type': 'application/json',
        'skyfire-api-key': apiKey
      },
      body: {
        type,
        buyerTag,
        sellerServiceId,
        tokenAmount,
        expiresAt,
        identityPermissions
      }
    })
    logger.info(`returning response from create token ${result}`)
    return result
  } catch (error) {
    logger.info('error calling createToken')
    throw new Error('API Error', { cause: error })
  }
}
