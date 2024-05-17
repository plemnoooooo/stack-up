export interface Row {
    id: string;
    name: string;
    score: number;
}

export interface Insert {
    name: string;
    score: number;
}

export interface Update {
    name?: string;
    score: number;
}