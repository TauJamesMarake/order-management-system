import { UserRole } from '.'


// create user
export interface iCreateUser {
    email: string
    password: string
    full_name: string
    role: UserRole
}

// update
export interface iUpdateUser {
    full_name?: string
    role?: UserRole
}