export type DocumentStatus = "pending" | "approved" | "rejected" | "processing";

export interface RawDocumentoApi {
  Id?: string | number;
  id?: string | number;
  NombreArchivo?: string;
  nombreArchivo?: string;
  MimeType?: string;
  mimeType?: string;
  TamanoBytes?: number;
  tamanoBytes?: number;
  SubidoPorUsuario?: string;
  subidoPorUsuario?: string;
  FechaSubida?: string;
  fechaSubida?: string;
  Estatus?: number;
  estatus?: number;
  ComentariosSubida?: string;
  comentariosSubida?: string;
  ComentariosDecision?: string;
  comentariosDecision?: string;
  FechaAutorizacion?: string | null;
  fechaAutorizacion?: string | null;
  TieneDocumentoLigado?: boolean;
  tieneDocumentoLigado?: boolean;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedBy: string;
  uploadDate: Date;
  status: DocumentStatus;
  customName?: string;
  observations?: string;
  attentionComments?: string;
  attentionDate?: Date;
  fileUrl?: string; 
  tieneDocumentoLigado?: boolean; 
}

export const documentsStorage = {
  getAll(): Document[] {
    if (typeof window === "undefined") return [];
    const docs = localStorage.getItem("documents");
    if (!docs) return [];
    return JSON.parse(docs, (key, value) => {
      if (key === "uploadDate") return new Date(value);
      return value;
    });
  },

  save(documents: Document[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem("documents", JSON.stringify(documents));
  },

  add(document: Omit<Document, "id" | "uploadDate" | "status">) {
    const docs = this.getAll();
    const newDoc: Document = {
      ...document,
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      uploadDate: new Date(),
      status: "pending",
    };
    docs.push(newDoc);
    this.save(docs);
    return newDoc;
  },

  updateStatus(id: string, status: DocumentStatus) {
    const docs = this.getAll();
    const doc = docs.find((d) => d.id === id);
    if (doc) {
      doc.status = status;
      this.save(docs);
    }
  },

  delete(id: string) {
    const docs = this.getAll().filter((d) => d.id !== id);
    this.save(docs);
  },
};
