import type { Todo } from "@/domain/todos";
import { Panel } from "@/ui/Panel";
import { TodoItem, TodoList } from "@/ui/TodoItem";
import { TodoActions } from "./TodoActions";

/** To do on the buyer home: price changes, part deliveries and replies, most urgent first. */
export function TodoPanel({ todos }: { todos: Todo[] }) {
  return (
    <div id="todo" className="scroll-mt-4">
      <Panel title="To do">
        {todos.length > 0 ? (
          <TodoList>
            {todos.map((todo) => (
              <TodoItem
                key={todo.key}
                tone={todo.tone}
                title={todo.title}
                detail={todo.detail}
                actions={<TodoActions action={todo.action} />}
              />
            ))}
          </TodoList>
        ) : (
          <p className="text-muted">You are all caught up.</p>
        )}
      </Panel>
    </div>
  );
}
