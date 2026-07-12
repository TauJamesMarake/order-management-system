#!/usr/bin/env tsx
/*
 * Provision a platform administrator (superadmin).
 * Usage:  npm run provision:admin
 *
 * Platform admins are stored in public.platform_admins, not public.users.
 * They authenticate via /api/platform/auth/login and have no access
 * to any business's order data — only to the businesses table itself.
 */

import dotenv from 'dotenv'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { ask, askSecret } from './lib/prompt'
import {
    validateEmail,
    validatePassword,
    validateMinLength,
} from './lib/validate'

dotenv.config()

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY missing')
    process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
})

async function assertEmailAvailable(email: string): Promise<void> {
    const { data } = await db
        .from('platform_admins')
        .select('id')
        .eq('email', email)
        .maybeSingle()

    if (data) throw new Error(`Email "${email}" is already registered to a platform admin.`)
}

async function createAuthAccount(
    client: SupabaseClient,
    email: string,
    password: string,
): Promise<string> {
    const { data, error } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    })

    if (error || !data.user) {
        throw new Error(`Auth account creation failed: ${error?.message ?? 'unknown error'}`)
    }

    return data.user.id
}

async function createPlatformAdmin(params: {
    authId: string
    email: string
    fullName: string
}): Promise<void> {
    const { error } = await db.from('platform_admins').insert({
        id: params.authId,
        email: params.email,
        full_name: params.fullName,
    })

    if (error) {
        throw new Error(`platform_admins insert failed: ${error.message}`)
    }
}

async function rollback(authId: string): Promise<void> {
    console.error('\nRolling back auth account...')
    const { error } = await db.auth.admin.deleteUser(authId)
    if (error) console.error(`  Warning: could not delete auth account: ${error.message}`)
    else console.error('  Auth account deleted.')
    console.error('Rollback complete. No changes were persisted.')
}

async function main(): Promise<void> {
    console.log('\nOMS — Provision Platform Admin')
    console.log('─'.repeat(40))
    console.log('Platform admins can manage businesses but cannot')
    console.log('access any business\'s order or user data.\n')

    const email = await ask('Email           : ')
    const fullName = await ask('Full name       : ')
    const password = await askSecret('Password        : ')
    const confirm = await askSecret('Confirm password: ')

    console.log()

    const errors: string[] = []

    const emailErr = validateEmail(email)
    if (emailErr) errors.push(`Email: ${emailErr}`)

    const nameErr = validateMinLength('Full name', fullName, 2, 255)
    if (nameErr) errors.push(nameErr)

    const passwordErr = validatePassword(password)
    if (passwordErr) errors.push(`Password: ${passwordErr}`)

    if (password !== confirm) errors.push('Passwords do not match.')

    if (errors.length > 0) {
        console.error('Validation errors:')
        errors.forEach(e => console.error(`  · ${e}`))
        process.exit(1)
    }

    try {
        process.stdout.write('Checking email availability... ')
        await assertEmailAvailable(email)
        console.log('OK')
    } catch (err) {
        console.error(`\n${(err as Error).message}`)
        process.exit(1)
    }

    console.log()

    let authId: string | null = null

    try {
        process.stdout.write('Creating auth account...      ')
        authId = await createAuthAccount(db, email, password)
        console.log('done.')

        process.stdout.write('Creating platform admin row... ')
        await createPlatformAdmin({ authId, email, fullName })
        console.log('done.')

    } catch (err) {
        console.error(`\nFailed: ${(err as Error).message}`)
        if (authId) await rollback(authId)
        process.exit(1)
    }

    console.log('\n' + '─'.repeat(40))
    console.log('Provision complete.')
    console.log()
    console.log('Platform admin')
    console.log(`  ID        : ${authId}`)
    console.log(`  Email     : ${email}`)
    console.log(`  Full name : ${fullName}`)
    console.log(`  Login at  : /api/platform/auth/login`)
    console.log('─'.repeat(40) + '\n')

    process.exit(0)
}

main().catch(err => {
    console.error('Unexpected error:', err)
    process.exit(1)
})