export interface Password {
    hash: string,
    salt: string
}

export interface Token {
    token: string,
    expires: string
}

export interface TokenStatus {
    validate: boolean,
    message: string,
    id?: string
}

export interface AuthUserSchema {
    email: string,
    password: string
}

export interface AuthUserError {
    email: string[],
    password: string[]
}

export interface UserSchema {
    email: string,
    password: string,
    confirmPassword?: string
}

export interface UserError {
    email: string[],
    password: string[],
    confirmPassword: string[]
}

export interface UserValidate {
    valid: boolean,
    errors?: object
}

export interface AuthValidate {
    valid: boolean,
    errors?: object,
    id?: string
}

export interface SignUpPayloadSchemaErrors {
    deviceId: string[]
} 

export interface SignupPayloadSchema {
    deviceId: string
}

export interface SigninPayloadSchemaErrors {
    deviceId: string[]
} 

export interface SigninPayloadSchema {
    deviceId: string
}