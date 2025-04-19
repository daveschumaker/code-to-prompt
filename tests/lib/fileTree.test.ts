import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import ignore from 'ignore';
import { generateFileTree } from '../../src/lib/fileTree';

describe('FileTree Generator', () => {
  it('builds a flat directory tree', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ft-'));
    await fs.writeFile(path.join(tmp, 'a.txt'), '');
    await fs.writeFile(path.join(tmp, 'b.txt'), '');
    const tree = await generateFileTree([tmp], {
      baseIgnorePath: tmp,
      mainIg: ignore(),
      includeHidden: false
    } as any);
    expect(tree).toBe('.\n├── a.txt\n├── b.txt');
  });

  it('builds a nested directory tree', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ft-'));
    const sub = path.join(tmp, 'sub');
    await fs.mkdir(sub);
    await fs.writeFile(path.join(tmp, 'root.txt'), '');
    await fs.writeFile(path.join(sub, 'child.txt'), '');
    const tree = await generateFileTree([tmp], {
      baseIgnorePath: tmp,
      mainIg: ignore(),
      includeHidden: false
    } as any);
    expect(tree).toContain('root.txt');
    expect(tree).toContain('sub');
    expect(tree).toContain('child.txt');
  });

  it('omits hidden files when includeHidden is false', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ft-'));
    await fs.writeFile(path.join(tmp, '.secret'), '');
    await fs.writeFile(path.join(tmp, 'public.txt'), '');
    const tree = await generateFileTree([tmp], {
      baseIgnorePath: tmp,
      mainIg: ignore(),
      includeHidden: false
    } as any);
    expect(tree).not.toContain('.secret');
    expect(tree).toContain('public.txt');
  });

  it('omits gitignored files', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ft-'));
    await fs.writeFile(path.join(tmp, 'keep.txt'), '');
    await fs.writeFile(path.join(tmp, 'skip.log'), '');
    const ig = ignore().add(['*.log']);
    const tree = await generateFileTree([tmp], {
      baseIgnorePath: tmp,
      mainIg: ig,
      includeHidden: false
    } as any);
    expect(tree).toContain('keep.txt');
    expect(tree).not.toContain('skip.log');
  });
});
