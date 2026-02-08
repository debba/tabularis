import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ViewEditorModal } from "../../../src/components/modals/ViewEditorModal";
import { invoke } from "@tauri-apps/api/core";
import { message, ask } from "@tauri-apps/plugin-dialog";
import React from "react";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  message: vi.fn(),
  ask: vi.fn(),
}));

// Mock i18n
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) {
        return `${key} ${JSON.stringify(params)}`;
      }
      return key;
    },
  }),
}));

// Mock icons
vi.mock("lucide-react", () => ({
  X: () => <div data-testid="icon-x" />,
  Loader2: () => <div data-testid="icon-loader" />,
  Eye: () => <div data-testid="icon-eye" />,
  AlertCircle: () => <div data-testid="icon-alert" />,
  Play: () => <div data-testid="icon-play" />,
}));

// Mock SqlEditorWrapper
vi.mock("../../../src/components/ui/SqlEditorWrapper", () => ({
  SqlEditorWrapper: ({ initialValue, onChange }: { initialValue: string; onChange: (val: string) => void }) => (
    <textarea
      aria-label="views.viewDefinition"
      value={initialValue}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

describe("ViewEditorModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    connectionId: "conn-123",
    onSuccess: vi.fn(),
  };

  const mockViewDefinition = "SELECT * FROM users WHERE active = 1";
  const mockPreviewResult = {
    columns: ["id", "username", "email"],
    rows: [
      [1, "user1", "user1@test.com"],
      [2, "user2", "user2@test.com"],
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_view_definition") return Promise.resolve(mockViewDefinition);
      if (cmd === "execute_query") {
        return Promise.resolve({
          ...mockPreviewResult,
          affected_rows: 0,
        });
      }
      if (cmd === "create_view") return Promise.resolve(undefined);
      if (cmd === "alter_view") return Promise.resolve(undefined);
      return Promise.reject(new Error(`Unexpected command: ${cmd}`));
    });
    vi.mocked(message).mockImplementation(() => Promise.resolve() as unknown as ReturnType<typeof message>);
    vi.mocked(ask).mockResolvedValue(true);
  });

  it("renders create view modal correctly", () => {
    render(<ViewEditorModal {...defaultProps} isNewView={true} />);
    
    expect(screen.getByText("views.createView")).toBeInTheDocument();
    expect(screen.getByText("views.createSubtitle")).toBeInTheDocument();
    expect(screen.getByLabelText(/views.viewName/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/views.viewDefinition/i)).toBeInTheDocument();
  });

  it("renders edit view modal correctly", async () => {
    render(<ViewEditorModal {...defaultProps} viewName="active_users" isNewView={false} />);
    
    await waitFor(() => {
      expect(screen.getByText("views.editView")).toBeInTheDocument();
      expect(screen.getByText(/active_users/)).toBeInTheDocument();
    });
  });

  it("loads view definition when editing existing view", async () => {
    render(<ViewEditorModal {...defaultProps} viewName="active_users" isNewView={false} />);
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("get_view_definition", {
        connectionId: "conn-123",
        viewName: "active_users",
      });
    });
  });

  it("allows entering view name for new view", () => {
    render(<ViewEditorModal {...defaultProps} isNewView={true} />);
    
    const nameInput = screen.getByLabelText(/views.viewName/i);
    fireEvent.change(nameInput, { target: { value: "my_new_view" } });
    
    expect(nameInput).toHaveValue("my_new_view");
  });

  it("allows entering view definition", () => {
    render(<ViewEditorModal {...defaultProps} isNewView={true} />);
    
    const definitionInput = screen.getByLabelText(/views.viewDefinition/i);
    fireEvent.change(definitionInput, { target: { value: "SELECT * FROM posts" } });
    
    expect(definitionInput).toHaveValue("SELECT * FROM posts");
  });

  it("runs preview when preview button is clicked", async () => {
    render(<ViewEditorModal {...defaultProps} isNewView={true} />);
    
    const definitionInput = screen.getByLabelText(/views.viewDefinition/i);
    fireEvent.change(definitionInput, { target: { value: "SELECT * FROM users" } });
    
    const previewButton = screen.getByText("views.runPreview");
    fireEvent.click(previewButton);
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("execute_query", {
        connectionId: "conn-123",
        query: "SELECT * FROM users",
        limit: 10,
        page: 1,
      });
    });
  });

  it("displays preview results", async () => {
    render(<ViewEditorModal {...defaultProps} isNewView={true} />);
    
    const definitionInput = screen.getByLabelText(/views.viewDefinition/i);
    fireEvent.change(definitionInput, { target: { value: "SELECT * FROM users" } });
    
    const previewButton = screen.getByText("views.runPreview");
    fireEvent.click(previewButton);
    
    await waitFor(() => {
      expect(screen.getByText("id")).toBeInTheDocument();
      expect(screen.getByText("username")).toBeInTheDocument();
      expect(screen.getByText("email")).toBeInTheDocument();
    });
  });

  it("creates view when save is clicked", async () => {
    render(<ViewEditorModal {...defaultProps} isNewView={true} />);
    
    const nameInput = screen.getByLabelText(/views.viewName/i);
    fireEvent.change(nameInput, { target: { value: "my_view" } });
    
    const definitionInput = screen.getByLabelText(/views.viewDefinition/i);
    fireEvent.change(definitionInput, { target: { value: "SELECT * FROM users" } });
    
    const createButton = screen.getByText("views.create");
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("create_view", {
        connectionId: "conn-123",
        viewName: "my_view",
        definition: "SELECT * FROM users",
      });
    });
  });

  it("alters view when saving existing view", async () => {
    render(<ViewEditorModal {...defaultProps} viewName="active_users" isNewView={false} />);
    
    await waitFor(() => {
      expect(screen.getByText("views.editView")).toBeInTheDocument();
    });

    const definitionInput = screen.getByLabelText(/views.viewDefinition/i);
    fireEvent.change(definitionInput, { target: { value: "SELECT * FROM users WHERE status = 'active'" } });
    
    const saveButton = screen.getByText("views.save");
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(ask).toHaveBeenCalled();
    });
    
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("alter_view", {
        connectionId: "conn-123",
        viewName: "active_users",
        definition: "SELECT * FROM users WHERE status = 'active'",
      });
    });
  });

  it("calls onSuccess and onClose after successful create", async () => {
    render(<ViewEditorModal {...defaultProps} isNewView={true} />);
    
    const nameInput = screen.getByLabelText(/views.viewName/i);
    fireEvent.change(nameInput, { target: { value: "my_view" } });
    
    const definitionInput = screen.getByLabelText(/views.viewDefinition/i);
    fireEvent.change(definitionInput, { target: { value: "SELECT * FROM users" } });
    
    const createButton = screen.getByText("views.create");
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(message).toHaveBeenCalledWith("views.createSuccess", { kind: "info" });
    });
    
    expect(defaultProps.onSuccess).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("shows error message when preview fails", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("Syntax error"));
    
    render(<ViewEditorModal {...defaultProps} isNewView={true} />);
    
    const definitionInput = screen.getByLabelText(/views.viewDefinition/i);
    fireEvent.change(definitionInput, { target: { value: "INVALID SQL" } });
    
    const previewButton = screen.getByText("views.runPreview");
    fireEvent.click(previewButton);
    
    await waitFor(() => {
      expect(screen.getByText(/views.previewError/)).toBeInTheDocument();
    });
  });

  it("calls onClose when cancel is clicked", () => {
    render(<ViewEditorModal {...defaultProps} isNewView={true} />);
    
    const cancelButton = screen.getByText("common.cancel");
    fireEvent.click(cancelButton);
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("does not render when isOpen is false", () => {
    render(<ViewEditorModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText("views.createView")).not.toBeInTheDocument();
  });

  it("disables save button when name is empty", () => {
    render(<ViewEditorModal {...defaultProps} isNewView={true} />);
    
    const createButton = screen.getByText("views.create");
    expect(createButton).toBeDisabled();
  });

  it("disables save button when definition is empty", () => {
    render(<ViewEditorModal {...defaultProps} isNewView={true} />);
    
    const nameInput = screen.getByLabelText(/views.viewName/i);
    fireEvent.change(nameInput, { target: { value: "my_view" } });

    // Clear the default definition
    const definitionInput = screen.getByLabelText(/views.viewDefinition/i);
    fireEvent.change(definitionInput, { target: { value: "" } });
    
    const createButton = screen.getByText("views.create");
    expect(createButton).toBeDisabled();
  });

  it("shows error when view name is missing on save", async () => {
    vi.mocked(message).mockResolvedValue(undefined);
    
    render(<ViewEditorModal {...defaultProps} isNewView={true} />);
    
    const definitionInput = screen.getByLabelText(/views.viewDefinition/i);
    fireEvent.change(definitionInput, { target: { value: "SELECT * FROM users" } });
    
    // Try to find and click save button - it should be disabled
    const createButton = screen.getByText("views.create");
    expect(createButton).toBeDisabled();
  });
});
