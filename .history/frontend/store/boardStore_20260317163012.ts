import { create } from 'zustand';

export interface Task {
  id: string;
  title: string;
  description: string;
  position: number;
}

export interface List {
  id: string;
  name: string;
  position: number;
  tasks: Task[];
}

export interface BoardState {
  lists: List[];
  setLists: (lists: List[]) => void;
  moveTask: (sourceListId: string, destListId: string, sourceIndex: number, destIndex: number) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  lists: [],
  setLists: (lists) => set({ lists }),
  moveTask: (sourceListId, destListId, sourceIndex, destIndex) =>
    set((state) => {
      // Create deep copy
      const newLists = state.lists.map(list => ({
        ...list,
        tasks: [...list.tasks]
      }));

      const sourceList = newLists.find((l) => l.id === sourceListId);
      const destList = newLists.find((l) => l.id === destListId);

      if (!sourceList || !destList) return state;

      // Remove from source
      const [movedTask] = sourceList.tasks.splice(sourceIndex, 1);

      // Add to destination
      destList.tasks.splice(destIndex, 0, movedTask);

      // Re-calculate positions in destination list
      destList.tasks = destList.tasks.map((task, index) => ({
        ...task,
        position: index * 1024, // Using generous spacing for future moves
      }));
      
      if(sourceListId !== destListId) {
        sourceList.tasks = sourceList.tasks.map((task, index) => ({
          ...task,
          position: index * 1024,
        }));
      }

      return { lists: newLists };
    }),
}));
