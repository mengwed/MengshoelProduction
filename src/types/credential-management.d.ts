interface PasswordCredential extends Credential {
  readonly id: string
  readonly password: string
  readonly name: string
  readonly iconURL: string
}

declare let PasswordCredential: {
  prototype: PasswordCredential
  new (data: { id: string; password: string; name?: string; iconURL?: string }): PasswordCredential
}

interface CredentialRequestOptions {
  password?: boolean
}

interface Window {
  PasswordCredential?: typeof PasswordCredential
}
