import logger from '../../logger'
import { createToken, getSellerResourceData } from './client'

export interface ToolResponse {
  content: Array<{
    type: 'text'
    text: string
  }>
  error?: object
}

export async function getSellerResourceDataContent(): Promise<string> {
  const content = await getSellerResourceData()
  return JSON.stringify(content)
}

export async function createKYAToken(
  params: {
    sellerServiceId: string
    buyerTag?: string | null
    expiresAt?: number | null
    identityPermissions?: string[] | null
  },
  apiKey: string
): Promise<ToolResponse> {
  const { buyerTag, sellerServiceId, expiresAt, identityPermissions } = params
  logger.info(params, 'creating kya token')
  const response = await createToken(
    apiKey,
    'kya',
    sellerServiceId,
    buyerTag ?? undefined,
    undefined,
    expiresAt ?? undefined,
    identityPermissions ?? undefined
  )
  logger.info(params, 'response from creating kya token received')
  if (response?.data === undefined || response.response.status !== 200) {
    const errorResponseBody = JSON.stringify(response.error)
    logger.info(
      { params, error: response.error },
      'unsuccessful response from kya token received'
    )
    return {
      content: [
        {
          type: 'text',
          text: `error creating token: ${response.response.status}: ${errorResponseBody}`
        }
      ],
      error: response.error
    }
  }
  logger.info(params, 'created kya token')
  return {
    content: [
      {
        type: 'text',
        text: `Creation of KYA token for ${sellerServiceId} is complete: ${response.data.token}`
      }
    ]
  }
}

export async function createPAYToken(
  params: {
    amount: string
    sellerServiceId: string
    buyerTag?: string | null
    expiresAt?: number | null
  },
  apiKey: string
): Promise<ToolResponse> {
  const { amount, buyerTag, sellerServiceId, expiresAt } = params
  logger.info('creating pay token')
  const response = await createToken(
    apiKey,
    'pay',
    sellerServiceId,
    buyerTag ?? undefined,
    amount,
    expiresAt ?? undefined
  )
  logger.info(params, 'response from creating pay token received')
  if (response?.data === undefined || response.response.status !== 200) {
    const errorResponseBody = JSON.stringify(response.error)
    logger.info(
      { params, error: response.error },
      'unsuccessful response from pay token received'
    )
    return {
      content: [
        {
          type: 'text',
          text: `error creating token: ${response.response.status}: ${errorResponseBody}`
        }
      ],
      error: response.error
    } // TODO: fill in better error messages here
  }
  logger.info(params, 'created pay token')
  return {
    content: [
      {
        type: 'text',
        text: `Creation of PAY token for ${sellerServiceId} is complete: ${response.data.token}`
      }
    ]
  }
}

export async function createKYAPAYToken(
  params: {
    amount: string
    sellerServiceId: string
    buyerTag?: string | null
    expiresAt?: number | null
    identityPermissions?: string[] | null
  },
  apiKey: string
): Promise<ToolResponse> {
  const { amount, buyerTag, sellerServiceId, expiresAt, identityPermissions } =
    params
  logger.info('creating kya-pay token')
  const response = await createToken(
    apiKey,
    'kya-pay',
    sellerServiceId,
    buyerTag ?? undefined,
    amount,
    expiresAt ?? undefined,
    identityPermissions ?? undefined
  )
  logger.info(params, 'response from creating kya-pay token received')
  if (response?.data === undefined || response.response.status !== 200) {
    const errorResponseBody = JSON.stringify(response.error)
    logger.info(
      { params, error: response.error },
      'unsuccessful response from kya-pay token received'
    )
    return {
      content: [
        {
          type: 'text',
          text: `error creating token: ${response.response.status}: ${errorResponseBody}`
        }
      ],
      error: response.error
    }
  }
  logger.info(params, 'created kya-pay token')
  return {
    content: [
      {
        type: 'text',
        text: `Creation of KYAPay token for ${sellerServiceId} is complete: ${response.data.token}`
      }
    ]
  }
}

// Valid identity permission field names for verification
export const IDENTITY_PERMISSIONS = [
  // Individual verification fields
  'selectedCountryCode',
  'selectedIdClass',
  'addressStreet1',
  'addressStreet2',
  'addressCity',
  'addressSubdivision',
  'addressPostalCode',
  'addressCountryCode',
  'birthdate',
  'expirationDate',
  'nameFirst',
  'nameMiddle',
  'nameLast',
  'phoneNumber',
  'issueDate',
  'issuingAuthority',
  // Business verification fields
  'businessName',
  'businessPhysicalAddressFull',
  'businessPhysicalAddressCity',
  'businessPhysicalAddressCountryCode',
  'businessPhysicalAddressPostalCode',
  'businessPhysicalAddressStreet1',
  'businessPhysicalAddressStreet2',
  'businessPhysicalAddressSubdivision',
  'businessRegisteredAddressCity',
  'businessRegisteredAddressCountryCode',
  'businessRegisteredAddressPostalCode',
  'businessRegisteredAddressStreet1',
  'businessRegisteredAddressStreet2',
  'businessRegisteredAddressSubdivision',
  'businessTaxIdentificationNumber'
] as const
