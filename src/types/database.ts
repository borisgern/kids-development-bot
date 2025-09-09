export interface Task {
  text: string;
  sent: boolean;
}

export interface TaskPool {
  tasks: Task[];
  lastReset: string;
}

export interface Database {
  subscribers: string[];
  taskPools: {
    danya: TaskPool;
    tema: TaskPool;
  };
}