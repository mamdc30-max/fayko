'use client'

import { createContext, useContext } from 'react'

interface UserContextType {
  isAdmin: boolean
}

export const UserContext = createContext<UserContextType>({ isAdmin: true })
export const useUserContext = () => useContext(UserContext)
