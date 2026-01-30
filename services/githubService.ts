
const BASE_URL = 'https://api.github.com';

// Helper for Unicode Base64 encoding/decoding
export const utf8_to_b64 = (str: string) => {
  return window.btoa(unescape(encodeURIComponent(str)));
};

export const b64_to_utf8 = (str: string) => {
  return decodeURIComponent(escape(window.atob(str)));
};

export const validateToken = async (token: string) => {
  const res = await fetch(`${BASE_URL}/user`, {
    headers: { Authorization: `token ${token}` },
  });
  if (!res.ok) throw new Error('Invalid Token');
  return await res.json();
};

export const getUserRepos = async (token: string) => {
  // Sort by 'updated' in 'desc' order to show latest repos first
  const res = await fetch(`${BASE_URL}/user/repos?sort=updated&direction=desc&per_page=50`, {
    headers: { Authorization: `token ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch repos');
  return await res.json();
};

export const createRepo = async (token: string, name: string, isPrivate: boolean) => {
  const res = await fetch(`${BASE_URL}/user/repos`, {
    method: 'POST',
    headers: { 
      Authorization: `token ${token}`,
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({ 
      name, 
      private: isPrivate,
      auto_init: true, // Initialize with README to ensure main branch exists
      description: 'Created with DroidCoder AI'
    })
  });
  
  if (!res.ok) {
     const err = await res.json();
     throw new Error(err.message || 'Failed to create repo');
  }
  return await res.json();
};

export const getRepoTree = async (token: string, owner: string, repo: string, branch: string = 'main') => {
  // First try to get the branch to ensure it exists and get its SHA
  let branchRes = await fetch(`${BASE_URL}/repos/${owner}/${repo}/branches/${branch}`, {
    headers: { Authorization: `token ${token}` },
  });

  if (!branchRes.ok) {
     // Fallback to master if main fails
     branchRes = await fetch(`${BASE_URL}/repos/${owner}/${repo}/branches/master`, {
        headers: { Authorization: `token ${token}` },
     });
     if (!branchRes.ok) throw new Error('Could not find main or master branch');
  }

  const branchData = await branchRes.json();
  const treeSha = branchData.commit.commit.tree.sha;

  // Get recursive tree
  const treeRes = await fetch(`${BASE_URL}/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, {
    headers: { Authorization: `token ${token}` },
  });
  
  if (!treeRes.ok) throw new Error('Failed to fetch tree');
  return await treeRes.json();
};

export const getBlob = async (token: string, url: string) => {
  const res = await fetch(url, {
    headers: { Authorization: `token ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch blob');
  const data = await res.json();
  return b64_to_utf8(data.content);
};

export const updateFile = async (
  token: string, 
  owner: string, 
  repo: string, 
  path: string, 
  content: string, 
  sha?: string,
  message: string = 'Update via DroidCoder'
) => {
  const body: any = {
    message,
    content: utf8_to_b64(content),
  };
  if (sha) body.sha = sha;

  const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { 
      Authorization: `token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to update file');
  }
  return await res.json();
};
