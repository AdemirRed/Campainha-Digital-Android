import { CreateDeliveryDTO, Delivery } from '@shared/types/delivery';
import { Event, CreateEventDTO } from '@shared/types/event';
import { Resident, CreateResidentDTO } from '@shared/types/resident';
import { ApiResponse, PaginatedResponse } from '@shared/types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const API_TOKEN = import.meta.env.VITE_API_TOKEN || '';

// The API URL is "<origin>/api"; uploaded media is served from
// "<origin>/storage/...". Strip the "/api" suffix to get the origin.
export const STORAGE_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
    } catch {
      throw new Error(`Não foi possível conectar em ${url} (backend rodando? URL correta?)`);
    }

    const rawBody = await response.text();
    let data: ApiResponse<T>;
    try {
      data = JSON.parse(rawBody);
    } catch {
      // A rate limiter, reverse proxy, or crash page can return plain
      // text/HTML instead of JSON - surface something readable instead
      // of a cryptic "Unexpected token" parse error.
      throw new Error(
        rawBody.slice(0, 200) || `Resposta inesperada do servidor (${response.status})`
      );
    }

    if (!data.success) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data.data as T;
  }

  // Events
  async createEvent(event: CreateEventDTO): Promise<Event> {
    return this.request<Event>('/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async getEvents(page = 1, pageSize = 20): Promise<PaginatedResponse<Event>> {
    return this.request<PaginatedResponse<Event>>(`/events?page=${page}&pageSize=${pageSize}`);
  }

  async getEvent(id: number): Promise<Event> {
    return this.request<Event>(`/events/${id}`);
  }

  async deleteEvent(id: number): Promise<void> {
    await this.request<void>(`/events/${id}`, { method: 'DELETE' });
  }

  // Deliveries
  async createDelivery(delivery: Partial<CreateDeliveryDTO>): Promise<Delivery> {
    return this.request<Delivery>('/deliveries', {
      method: 'POST',
      body: JSON.stringify(delivery),
    });
  }

  async getDeliveries(page = 1, pageSize = 20): Promise<PaginatedResponse<Delivery>> {
    return this.request<PaginatedResponse<Delivery>>(`/deliveries?page=${page}&pageSize=${pageSize}`);
  }

  // Settings (requires auth)
  async getSettings(token: string): Promise<any> {
    return this.request<any>('/settings', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  async getSetting(key: string, token: string): Promise<any> {
    return this.request<any>(`/settings/${key}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  async setSetting(key: string, value: string, token: string): Promise<any> {
    return this.request<any>(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  // Residents
  async getResidents(): Promise<Resident[]> {
    return this.request<Resident[]>('/residents', {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
      },
    });
  }

  async createResident(resident: CreateResidentDTO): Promise<Resident> {
    return this.request<Resident>('/residents', {
      method: 'POST',
      body: JSON.stringify(resident),
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
      },
    });
  }

  async deleteResident(id: number): Promise<void> {
    await this.request<void>(`/residents/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
      },
    });
  }

  // Face recognition (processed server-side)
  async getFaceDescriptor(imageBase64: string): Promise<number[]> {
    const result = await this.request<{ descriptor: number[] }>('/face/descriptor', {
      method: 'POST',
      body: JSON.stringify({ image: imageBase64 }),
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
      },
    });
    return result.descriptor;
  }

  async recognizeFace(imageBase64: string): Promise<{ resident: Resident; isAdmin: boolean } | null> {
    return this.request<{ resident: Resident; isAdmin: boolean } | null>('/face/recognize', {
      method: 'POST',
      body: JSON.stringify({ image: imageBase64 }),
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
      },
    });
  }

  // Free-text / audio message left by a visitor ("outro motivo")
  async sendMessage(message: { text?: string; audioBase64?: string }): Promise<Event> {
    return this.request<Event>('/messages', {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  // Short video clip of a visitor the face recognition couldn't match
  async recordUnrecognizedVisit(videoBase64: string): Promise<Event> {
    return this.request<Event>('/visitors/unrecognized', {
      method: 'POST',
      body: JSON.stringify({ videoBase64 }),
    });
  }

  // AI assistant (Ollama Cloud) - talks to unrecognized visitors and
  // summarizes recent activity for recognized residents
  async chatWithAssistant(messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
    const result = await this.request<{ reply: string }>('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
    return result.reply;
  }

  async getAssistantSummary(): Promise<{ text: string; stats: any; messages?: string[] }> {
    return this.request<{ text: string; stats: any; messages?: string[] }>('/assistant/summary');
  }

  // Disk usage breakdown (audios/videos/continuous/photos)
  async getStorageUsage(): Promise<{
    audios: { bytes: number; files: number };
    videos: { bytes: number; files: number };
    continuous: { bytes: number; files: number };
    photos: { bytes: number; files: number };
    totalBytes: number;
  }> {
    return this.request('/storage/usage');
  }

  // 24/7 rolling recording (7-day retention, oldest chunks auto-deleted)
  async uploadContinuousChunk(videoBase64: string): Promise<{ filename: string }> {
    return this.request('/recordings', {
      method: 'POST',
      body: JSON.stringify({ videoBase64 }),
    });
  }

  async getContinuousRecordings(): Promise<{ filename: string; size: number; createdAt: string }[]> {
    return this.request('/recordings');
  }

  async deleteContinuousRecording(filename: string): Promise<void> {
    await this.request<void>(`/recordings/${encodeURIComponent(filename)}`, { method: 'DELETE' });
  }

  // Standing instructions the resident leaves for the AI assistant to
  // follow in every conversation (e.g. delivery codes, where to leave packages)
  async getAssistantInstructions(): Promise<string> {
    try {
      const result = await this.request<{ value: string }>('/settings/assistant_instructions', {
        headers: { Authorization: `Bearer ${API_TOKEN}` },
      });
      return result.value;
    } catch {
      return '';
    }
  }

  async setAssistantInstructions(value: string): Promise<void> {
    await this.request(`/settings/assistant_instructions`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
  }

  // Resident-recorded presence status (e.g. "saí, volto às 21h"), used by
  // the assistant to answer visitors asking if someone is home
  async getPresenceStatus(): Promise<{ text: string; updatedAt: string } | null> {
    try {
      const result = await this.request<{ value: string }>('/settings/presence_status', {
        headers: { Authorization: `Bearer ${API_TOKEN}` },
      });
      return result.value ? JSON.parse(result.value) : null;
    } catch {
      return null;
    }
  }

  async setPresenceStatus(text: string): Promise<void> {
    const value = JSON.stringify({ text, updatedAt: new Date().toISOString() });
    await this.request(`/settings/presence_status`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
  }
}

export const apiService = new ApiService();
