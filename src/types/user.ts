/** 用户公开信息（来自后端） */
export interface UserPublic {
  id: number
  email: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

/** 登录/注册响应 */
export interface AuthResponse {
  user: UserPublic
  token: string
}

/** 登录请求 */
export interface LoginRequest {
  email: string
  password: string
}

/** 注册请求 */
export interface RegisterRequest {
  email: string
  password: string
  display_name?: string
}

/** 更新个人资料请求 */
export interface UpdateProfileRequest {
  display_name?: string
  bio?: string
}