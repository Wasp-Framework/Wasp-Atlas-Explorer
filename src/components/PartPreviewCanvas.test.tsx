// @vitest-environment jsdom
import React from 'react';
import { cleanup, render as renderComponent } from '@testing-library/react';
import { BoxGeometry, Mesh, MeshStandardMaterial, Texture } from 'three';
import { PartPreviewCanvas } from './PartPreviewCanvas';
import { vi } from 'vitest';
import { renderThumbnail, retainThumbnailRenderer } from '../lib/thumbnailRenderer';

const mocks = vi.hoisted(() => ({ renderers: [] as any[], observers: [] as any[] }));
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement('canvas');
      dispose = vi.fn();
      forceContextLoss = vi.fn();
      renderLists = { dispose: vi.fn() };
      setPixelRatio = vi.fn();
      setClearAlpha = vi.fn();
      setSize = vi.fn((width, height) => {
        this.domElement.width = width;
        this.domElement.height = height;
      });
      render = vi.fn((scene) => {
        const mesh = scene.children[0];
        vi.spyOn(mesh.geometry, 'dispose');
        for (const material of [mesh.material].flat()) vi.spyOn(material, 'dispose');
      });
      constructor() { mocks.renderers.push(this); }
    },
  };
});

beforeEach(() => {
  mocks.renderers.length = 0;
  mocks.observers.length = 0;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as any);
  vi.stubGlobal('ResizeObserver', class {
    disconnect = vi.fn();
    observe = vi.fn();
    constructor(public callback: () => void) { mocks.observers.push(this); }
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const source = () => new Mesh(new BoxGeometry(), new MeshStandardMaterial());
const previews = (meshes: Mesh[], color = '#ff0000') => (
  <>{meshes.map((mesh, i) => <PartPreviewCanvas key={i} source={mesh} color={color} label={`Part ${i}`} />)}</>
);

describe('shared thumbnail renderer', () => {
  it.each([17, 50])('renders %i distinct sources with one context and releases only cloned resources', (count) => {
    const meshes = Array.from({ length: count }, source);
    const originals = meshes.flatMap(mesh => [vi.spyOn(mesh.geometry, 'dispose'), vi.spyOn(mesh.material as any, 'dispose')]);
    const view = renderComponent(previews(meshes));
    expect(view.container.querySelectorAll('canvas')).toHaveLength(count);
    expect(mocks.renderers).toHaveLength(1);
    const renderer = mocks.renderers[0];
    expect(renderer.render).toHaveBeenCalledTimes(count);
    for (const [scene] of renderer.render.mock.calls) {
      const mesh = scene.children[0];
      expect(mesh.geometry.dispose).toHaveBeenCalledOnce();
      expect(mesh.material.dispose).toHaveBeenCalledOnce();
      expect(mesh.material.color.getHexString()).toBe('ff0000');
    }
    expect(originals.every(spy => spy.mock.calls.length === 0)).toBe(true);
    view.unmount();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(renderer.forceContextLoss).toHaveBeenCalledOnce();
    expect(mocks.observers.every(observer => observer.disconnect.mock.calls.length === 1)).toBe(true);
  });

  it('reuses the context for colors, resize and dataset replacement; releases it on navigation', () => {
    for (let cycle = 0; cycle < 3; cycle++) {
      const meshes = Array.from({ length: 50 }, source);
      const view = renderComponent(previews(meshes));
      const renderer = mocks.renderers[cycle];
      view.rerender(previews(meshes, '#00ff00'));
      expect(renderer.render.mock.lastCall[0].children[0].material.color.getHexString()).toBe('00ff00');
      const host = view.container.querySelector('.part-preview-canvas')!;
      Object.defineProperties(host, { clientWidth: { value: 240 }, clientHeight: { value: 160 } });
      mocks.observers[mocks.observers.length - 50].callback();
      expect(renderer.setSize).toHaveBeenLastCalledWith(240, 160, false);
      expect(renderer.render.mock.lastCall[1].aspect).toBe(1.5);
      view.rerender(previews(Array.from({ length: 17 }, source)));
      expect(mocks.renderers).toHaveLength(cycle + 1);
      expect(renderer.dispose).not.toHaveBeenCalled();
      view.unmount();
      expect(mocks.renderers.every(item => item.forceContextLoss.mock.calls.length === 1)).toBe(true);
    }
  });

  it('does not allocate for missing geometry and handles StrictMode cleanup', () => {
    const view = renderComponent(<React.StrictMode><PartPreviewCanvas source={{}} color="#fff" label="Empty" /></React.StrictMode>);
    expect(mocks.renderers).toHaveLength(0);
    view.rerender(<React.StrictMode><PartPreviewCanvas source={source()} color="#fff" label="Valid" /></React.StrictMode>);
    expect(mocks.renderers).toHaveLength(1);
    view.unmount();
    expect(mocks.renderers[0].forceContextLoss).toHaveBeenCalledOnce();
  });

  it('disposes temporary resources even when rendering fails', () => {
    const release = retainThumbnailRenderer();
    const canvas = document.createElement('canvas');
    const mesh = source();
    try {
      renderThumbnail(canvas, mesh, '#fff', 120, 120);
      let failedMesh: any;
      mocks.renderers[0].render.mockImplementationOnce((scene: any) => {
        failedMesh = scene.children[0];
        vi.spyOn(failedMesh.geometry, 'dispose');
        vi.spyOn(failedMesh.material, 'dispose');
        throw new Error('Render failed');
      });
      expect(() => renderThumbnail(canvas, mesh, '#fff', 120, 120)).toThrow('Render failed');
      expect(failedMesh.geometry.dispose).toHaveBeenCalledOnce();
      expect(failedMesh.material.dispose).toHaveBeenCalledOnce();
    } finally {
      release();
    }
  });

  it('preserves source materials and textures, including material arrays', () => {
    const texture = new Texture();
    const textureDispose = vi.spyOn(texture, 'dispose');
    const material = new MeshStandardMaterial({ color: '#123456', map: texture });
    const mesh = new Mesh(new BoxGeometry(), [material, material]);
    const view = renderComponent(<PartPreviewCanvas source={mesh} color="#abcdef" label="Multi" />);
    const clone = mocks.renderers[0].render.mock.lastCall[0].children[0];
    expect(clone.material).toHaveLength(2);
    expect(clone.material.every((m: any) => m.dispose.mock.calls.length === 1)).toBe(true);
    view.unmount();
    expect(material.color.getHexString()).toBe('123456');
    expect(textureDispose).not.toHaveBeenCalled();
  });
});
