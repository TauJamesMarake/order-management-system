import { createClient } from '@supabase/supabase-js'
import { supabase } from '../db/supabase'

const anonClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
)

export interface iPlatformLoginResult {
    token: string
    refresh_token: string
    admin: {
        id: string
        email: string
        full_name: string
    }
}

export async function login(
    email: string,
    password: string,
): Promise<iPlatformLoginResult> {
    const { data, error } = await anonClient.auth.signInWithPassword({
        email,
        password,
    })

    if (error || !data.session || !data.user) {
        throw new Error('Invalid email or password.')
    }

    const { data: admin, error: adminError } = await supabase
        .from('platform_admins')
        .select('id, email, full_name, is_active')
        .eq('id', data.user.id)
        .single()

    if (adminError || !admin) {
        throw new Error('Invalid email or password.')
    }

    if (!admin.is_active) {
        throw new Error('This platform admin account has been deactivated.')
    }

    return {
        token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        admin: {
            id: admin.id,
            email: admin.email,
            full_name: admin.full_name,
        },
    }
}