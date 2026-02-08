"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { type ValidationResult } from '@/lib/validation/graph';

interface ValidationContextType {
    validation: ValidationResult;
    activeNodeId: string | null;
}

const ValidationContext = createContext<ValidationContextType | undefined>(undefined);

export function ValidationProvider({
    children,
    validation,
    activeNodeId
}: {
    children: ReactNode;
    validation: ValidationResult;
    activeNodeId: string | null;
}) {
    return (
        <ValidationContext.Provider value={{ validation, activeNodeId }}>
            {children}
        </ValidationContext.Provider>
    );
}

export function useValidationContext() {
    const context = useContext(ValidationContext);
    if (context === undefined) {
        throw new Error('useValidationContext must be used within a ValidationProvider');
    }
    return context;
}
