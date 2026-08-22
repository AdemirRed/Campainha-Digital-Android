import { CreateDeliveryDTO, Delivery } from '@shared/types/delivery';
import { Event, CreateEventDTO } from '@shared/types/event';
import { ApiResponse, PaginatedResponse } from '@shared/types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data: ApiResponse<T> = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Request failed');
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
}

export const apiService = new ApiService();
