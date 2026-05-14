import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

interface JsonInputMockProps {
  value: unknown;
  onChange: (next: unknown) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
}

const jsonInputProps: { current: JsonInputMockProps | null } = {
  current: null,
};

vi.mock("../../../src/components/ui/JsonInput", () => ({
  JsonInput: (props: JsonInputMockProps) => {
    jsonInputProps.current = props;
    return (
      <textarea
        data-testid="mock-json-input"
        value={JSON.stringify(props.value)}
        readOnly={props.readOnly}
        onChange={(e) => {
          try {
            props.onChange(JSON.parse(e.target.value));
          } catch {
            // ignore parse errors in the mock
          }
        }}
      />
    );
  },
}));

// eslint-disable-next-line import/first
import { JsonViewerModal } from "../../../src/components/modals/JsonViewerModal";

describe("JsonViewerModal", () => {
  beforeEach(() => {
    jsonInputProps.current = null;
  });

  it("does not render when isOpen is false", () => {
    render(
      <JsonViewerModal
        isOpen={false}
        onClose={vi.fn()}
        value={{ a: 1 }}
      />,
    );

    expect(screen.queryByTestId("mock-json-input")).not.toBeInTheDocument();
  });

  it("renders the modal and seeds the editor with the provided value", () => {
    render(
      <JsonViewerModal
        isOpen={true}
        onClose={vi.fn()}
        value={{ a: 1 }}
      />,
    );

    expect(screen.getByTestId("mock-json-input")).toBeInTheDocument();
    expect(jsonInputProps.current?.value).toEqual({ a: 1 });
  });

  it("renders the default title when none is provided", () => {
    render(
      <JsonViewerModal isOpen={true} onClose={vi.fn()} value={null} />,
    );

    expect(screen.getByText("jsonViewer.title")).toBeInTheDocument();
  });

  it("renders a custom title when provided", () => {
    render(
      <JsonViewerModal
        isOpen={true}
        onClose={vi.fn()}
        value={null}
        title="Inspect Payload"
      />,
    );

    expect(screen.getByText("Inspect Payload")).toBeInTheDocument();
    expect(screen.queryByText("jsonViewer.title")).not.toBeInTheDocument();
  });

  it("invokes onClose when the Cancel button is clicked", () => {
    const onClose = vi.fn();
    render(
      <JsonViewerModal
        isOpen={true}
        onClose={onClose}
        onSave={vi.fn()}
        value={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose when the close (X) button is clicked", () => {
    const onClose = vi.fn();
    render(
      <JsonViewerModal isOpen={true} onClose={onClose} value={null} />,
    );

    const closeButton = screen.getByLabelText("common.close");
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onSave with the current edited value and closes the modal", () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(
      <JsonViewerModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        value={{ a: 1 }}
      />,
    );

    fireEvent.change(screen.getByTestId("mock-json-input"), {
      target: { value: JSON.stringify({ a: 2 }) },
    });

    fireEvent.click(screen.getByRole("button", { name: "jsonViewer.save" }));

    expect(onSave).toHaveBeenCalledWith({ a: 2 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("resets the edited value when the modal is reopened", () => {
    const { rerender } = render(
      <JsonViewerModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        value={{ a: 1 }}
      />,
    );

    fireEvent.change(screen.getByTestId("mock-json-input"), {
      target: { value: JSON.stringify({ a: 99 }) },
    });

    rerender(
      <JsonViewerModal
        isOpen={false}
        onClose={vi.fn()}
        onSave={vi.fn()}
        value={{ a: 1 }}
      />,
    );

    rerender(
      <JsonViewerModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        value={{ b: 5 }}
      />,
    );

    expect(jsonInputProps.current?.value).toEqual({ b: 5 });
  });

  describe("readOnly mode", () => {
    it("hides the Save button", () => {
      render(
        <JsonViewerModal
          isOpen={true}
          onClose={vi.fn()}
          onSave={vi.fn()}
          value={{ a: 1 }}
          readOnly
        />,
      );

      expect(
        screen.queryByRole("button", { name: "jsonViewer.save" }),
      ).not.toBeInTheDocument();
    });

    it("forwards readOnly to JsonInput", () => {
      render(
        <JsonViewerModal
          isOpen={true}
          onClose={vi.fn()}
          value={{ a: 1 }}
          readOnly
        />,
      );

      expect(jsonInputProps.current?.readOnly).toBe(true);
    });

    it("still shows the footer Close control", () => {
      const onClose = vi.fn();
      render(
        <JsonViewerModal
          isOpen={true}
          onClose={onClose}
          value={{ a: 1 }}
          readOnly
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "jsonViewer.close" }),
      );

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("hides the Save button when no onSave callback is provided", () => {
    render(
      <JsonViewerModal isOpen={true} onClose={vi.fn()} value={{ a: 1 }} />,
    );

    expect(
      screen.queryByRole("button", { name: "jsonViewer.save" }),
    ).not.toBeInTheDocument();
  });
});
