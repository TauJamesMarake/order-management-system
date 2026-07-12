#!/usr/bin/env tsx
/*
 * Provision a new business tenant and its first admin user.
 * Usage:  npm run provision
 *
 * Creates (in this order):
 *   1. Supabase Auth account for the admin user
 *   2. Row in public.businesses
 *   3. Row in public.users (role = admin, bound to new business)
 */

import dotenv from 'dotenv'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { ask, askSecret } from './lib/prompt'
import {
    validateEmail,
    validateOrderPrefix,
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

async function assertPrefixAvailable(prefix: string): Promise<void> {
    const { data } = await db
        .from('businesses')
        .select('id')
        .eq('order_prefix', prefix)
        .maybeSingle()

    if (data) throw new Error(`Order prefix "${prefix}" is unavailable.`)
}

async function assertEmailAvailable(email: string): Promise<void> {
    const { data } = await db
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

    if (data) throw new Error(`Email "${email}" is already registered to a user.`)
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

async function createBusiness(name: string, orderPrefix: string): Promise<string> {
    const { data, error } = await db
        .from('businesses')
        .insert({ name, order_prefix: orderPrefix })
        .select('id')
        .single()

    if (error || !data) {
        throw new Error(`Business insert failed: ${error?.message ?? 'unknown error'}`)
    }

    return data.id
}

async function createAdminUser(params: {
    authId: string
    businessId: string
    email: string
    fullName: string
}): Promise<void> {
    const { error } = await db.from('users').insert({
        id: params.authId,
        business_id: params.businessId,
        email: params.email,
        full_name: params.fullName,
        role: 'admin',
    })

    if (error) {
        throw new Error(`User insert failed: ${error.message}`)
    }
}

async function rollback(authId: string | null, businessId: string | null): Promise<void> {
    console.error('\nRolling back...')

    if (businessId) {
        const { error } = await db.from('businesses').delete().eq('id', businessId)
        if (error) console.error(`  Warning: could not delete business row: ${error.message}`)
        else console.error('  Business row deleted.')
    }

    if (authId) {
        const { error } = await db.auth.admin.deleteUser(authId)
        if (error) console.error(`  Warning: could not delete auth account: ${error.message}`)
        else console.error('  Auth account deleted.')
    }

    console.error('Rollback complete. No changes were persisted.')
}

async function main(): Promise<void> {
    console.log('\nProvision New Business')
    console.log('─'.repeat(40))

    const businessName = await ask('Business name          : ')
    const rawPrefix = await ask('Order prefix (e.g. ND) : ')
    const orderPrefix = rawPrefix.toUpperCase()
    const adminEmail = await ask('Admin email            : ')
    const adminFullName = await ask('Admin full name        : ')
    const adminPassword = await askSecret('Admin password         : ')
    const confirmPass = await askSecret('Confirm password       : ')

    console.log()

    // validate everything before any network call
    const errors: string[] = []

    const nameErr = validateMinLength('Business name', businessName, 1, 255)
    if (nameErr) errors.push(nameErr)

    const prefixErr = validateOrderPrefix(orderPrefix)
    if (prefixErr) errors.push(`Order prefix: ${prefixErr}`)

    const emailErr = validateEmail(adminEmail)
    if (emailErr) errors.push(`Email: ${emailErr}`)

    const nameFullErr = validateMinLength('Full name', adminFullName, 2, 255)
    if (nameFullErr) errors.push(nameFullErr)

    const passwordErr = validatePassword(adminPassword)
    if (passwordErr) errors.push(`Password: ${passwordErr}`)

    if (adminPassword !== confirmPass) errors.push('Passwords do not match.')

    if (errors.length > 0) {
        console.error('Validation errors:')
        errors.forEach(e => console.error(`  · ${e}`))
        process.exit(1)
    }

    try {
        process.stdout.write('Checking prefix availability... ')
        await assertPrefixAvailable(orderPrefix)
        console.log('OK')

        process.stdout.write('Checking email availability...  ')
        await assertEmailAvailable(adminEmail)
        console.log('OK')
    } catch (err) {
        console.error(`\n${(err as Error).message}`)
        process.exit(1)
    }

    console.log()

    let authId: string | null = null
    let businessId: string | null = null

    try {
        process.stdout.write('Creating auth account... ')
        authId = await createAuthAccount(db, adminEmail, adminPassword)
        console.log('done.')

        process.stdout.write('Creating business...     ')
        businessId = await createBusiness(businessName, orderPrefix)
        console.log('done.')

        process.stdout.write('Creating admin user...   ')
        await createAdminUser({ authId, businessId, email: adminEmail, fullName: adminFullName })
        console.log('done.')

    } catch (err) {
        console.error(`\nFailed: ${(err as Error).message}`)
        await rollback(authId, businessId)
        process.exit(1)
    }

    console.log('\n' + '─'.repeat(40))
    console.log('Provision complete.')
    console.log()
    console.log('Business')
    console.log(`  ID     : ${businessId}`)
    console.log(`  Name   : ${businessName}`)
    console.log(`  Prefix : ${orderPrefix}`)
    console.log()
    console.log('Admin user')
    console.log(`  ID     : ${authId}`)
    console.log(`  Email  : ${adminEmail}`)
    console.log(`  Role   : admin`)
    console.log('─'.repeat(40) + '\n')

    process.exit(0)
}

main().catch(err => {
    console.error('Unexpected error:', err)
    process.exit(1)
})