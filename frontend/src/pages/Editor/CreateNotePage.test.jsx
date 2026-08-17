import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { renderWithRouter } from "../../test/utils";
import api from "../../api/axios";
import CreateNotePage from "./CreateNotePage";

vi.mock("../../api/axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

const savedPost = {
  _id: "p1",
  content: "dear you",
  visibility: "private",
  style: {
    font: "monospace",
    background: "#171717",
    textColor: "#ffffff",
    fontSize: 1.4,
    lineHeight: 1.8,
    letterSpacing: 0.05,
    textAlign: "left",
  },
  media: [
    { url: "http://cdn/cover.png", type: "image" },
    { url: "http://cdn/song.mp3", type: "audio" },
  ],
  tagSlugs: ["regret", "rain"],
};

const defaultStyle = {
  font: "serif",
  background: "#ffffff",
  textColor: "#1c1c1a",
  fontSize: 1.15,
  lineHeight: 1.6,
  letterSpacing: 0,
  textAlign: "center",
};

const renderCreate = () =>
  renderWithRouter(<CreateNotePage />, { route: "/write", path: "/write" });

const renderEdit = () =>
  renderWithRouter(<CreateNotePage />, { route: "/write/p1", path: "/write/:id" });

/** Router with a home route so the post-save redirect is observable. */
const renderWithHome = (route = "/write") =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/write" element={<CreateNotePage />} />
        <Route path="/write/:id" element={<CreateNotePage />} />
        <Route path="/" element={<div>Home page</div>} />
      </Routes>
    </MemoryRouter>
  );

const composer = () => screen.getByPlaceholderText("Write your unsent archive...");
const tagsField = () => screen.getByLabelText(/Tags/);
const write = (text) => fireEvent.change(composer(), { target: { value: text } });

describe("CreateNotePage", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    api.put.mockReset();
  });

  it("renders an empty composer with the style controls and no note request", () => {
    renderCreate();

    expect(screen.getByRole("heading", { name: "Editor settings" })).toBeInTheDocument();
    expect(composer()).toHaveValue("");
    expect(screen.getByText("0/5000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update" })).not.toBeInTheDocument();
    // style controls
    expect(screen.getByLabelText("Visibility")).toHaveValue("public");
    expect(screen.getByLabelText("Font")).toHaveValue("serif");
    expect(screen.getByLabelText("Text alignment")).toHaveValue("center");
    expect(screen.getByLabelText("Text color")).toHaveValue("#1c1c1a");
    expect(document.querySelectorAll(".preset-row .swatch")).toHaveLength(10);
    // media controls
    expect(screen.getByPlaceholderText("https://...")).toBeInTheDocument();
    expect(screen.getByText("Drop or pick a JPG / PNG / GIF / WEBP")).toBeInTheDocument();
    expect(screen.getByText("Drop or pick an MP3 / WAV / OGG / M4A")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("tracks the character count and the visibility label as the note is written", () => {
    renderCreate();
    write("hello");
    expect(screen.getByText("5/5000")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Visibility"), { target: { value: "anonymous" } });
    expect(screen.getByText("anonymous", { selector: ".note-meta span" })).toBeInTheDocument();
  });

  it("submits the composed note and redirects home", async () => {
    api.post.mockResolvedValueOnce({ data: {} });
    renderWithHome();

    write("hello archive");
    fireEvent.change(screen.getByLabelText("Font"), { target: { value: "georgia" } });
    fireEvent.change(screen.getByLabelText(/Text alignment/), { target: { value: "right" } });
    fireEvent.change(screen.getByPlaceholderText("https://..."), {
      target: { value: "http://cdn/cover.png" },
    });
    fireEvent.change(tagsField(), { target: { value: " Rain, REGRET ," } });
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/posts", {
        content: "hello archive",
        visibility: "public",
        style: { ...defaultStyle, font: "georgia", textAlign: "right" },
        media: [{ url: "http://cdn/cover.png", type: "image" }],
        tagSlugs: ["rain", "regret"],
      })
    );
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("picks a background preset and reflects it on the canvas", () => {
    renderCreate();
    const swatches = document.querySelectorAll(".preset-row .swatch");
    fireEvent.click(swatches[5]);

    expect(swatches[5].className).toContain("active");
    expect(document.querySelector(".editor-canvas")).toHaveStyle({
      backgroundColor: "rgb(43, 31, 27)",
    });
  });

  it("shows the API error and stays on the page when saving fails", async () => {
    api.post.mockRejectedValueOnce({ response: { data: { message: "Content is required" } } });
    renderWithHome();

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByText("Content is required")).toBeInTheDocument();
    expect(screen.queryByText("Home page")).not.toBeInTheDocument();
  });

  it("prefills everything from the note being edited and updates it", async () => {
    api.get.mockResolvedValue({ data: { post: savedPost } });
    api.put.mockResolvedValueOnce({ data: {} });
    renderWithHome("/write/p1");

    expect(await screen.findByDisplayValue("dear you")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/posts/p1");
    expect(screen.getByLabelText("Visibility")).toHaveValue("private");
    expect(screen.getByLabelText("Font")).toHaveValue("monospace");
    expect(screen.getByLabelText("Text alignment")).toHaveValue("left");
    expect(tagsField()).toHaveValue("regret, rain");
    expect(screen.getByPlaceholderText("https://...")).toHaveValue("http://cdn/cover.png");
    expect(screen.getByPlaceholderText("Or any direct audio URL")).toHaveValue(
      "http://cdn/song.mp3"
    );
    expect(document.querySelector(".upload-preview img")).toHaveAttribute(
      "src",
      "http://cdn/cover.png"
    );

    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/posts/p1", {
        content: "dear you",
        visibility: "private",
        style: savedPost.style,
        media: savedPost.media,
        tagSlugs: ["regret", "rain"],
      })
    );
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("uploads a picked cover image and previews it", async () => {
    api.post.mockResolvedValueOnce({ data: { asset: { url: "http://cdn/up.png" } } });
    renderCreate();

    const input = document.querySelector('input[type="file"][accept="image/*,.gif"]');
    fireEvent.change(input, {
      target: { files: [new File(["x"], "up.png", { type: "image/png" })] },
    });

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/uploads", expect.any(FormData)));
    await waitFor(() =>
      expect(document.querySelector(".upload-preview img")).toHaveAttribute(
        "src",
        "http://cdn/up.png"
      )
    );
    expect(screen.getByPlaceholderText("https://...")).toHaveValue("http://cdn/up.png");
    // the file input is reset so the same file can be re-picked
    expect(input.value).toBe("");
  });

  it("shows the upload error when the soundtrack upload fails", async () => {
    api.post.mockRejectedValueOnce({ response: { status: 413, data: {} } });
    renderCreate();

    fireEvent.change(document.querySelector('input[type="file"][accept="audio/*"]'), {
      target: { files: [new File(["x"], "big.mp3", { type: "audio/mpeg" })] },
    });

    expect(await screen.findByText("That file is too large.")).toBeInTheDocument();
    expect(screen.getByText("Drop or pick an MP3 / WAV / OGG / M4A")).toBeInTheDocument();
  });

  it("removes an attached cover image", async () => {
    api.get.mockResolvedValue({ data: { post: savedPost } });
    renderEdit();

    await waitFor(() => expect(document.querySelector(".upload-preview img")).toBeTruthy());
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);

    expect(document.querySelector(".upload-preview img")).toBeNull();
    expect(screen.getByPlaceholderText("https://...")).toHaveValue("");
  });
});
