type IndexRequest = {
	files: Array<{
		path: string;
		content: string;
	}>;
	chunkSize: number;
};

type IndexResponse = {
	files: Array<{
		path: string;
		chunks: string[];
		chunkCount: number;
	}>;
};

self.onmessage = (event: MessageEvent<IndexRequest>) => {
	const chunkSize = Math.max(event.data.chunkSize, 500);
	const files = event.data.files.map(file => {
		const chunks = chunkContent(file.content, chunkSize);
		return {
			path: file.path,
			chunks,
			chunkCount: chunks.length
		};
	});

	self.postMessage({ files } satisfies IndexResponse);
};

function chunkContent(content: string, chunkSize: number): string[] {
	const chunks: string[] = [];
	for (let offset = 0; offset < content.length; offset += chunkSize) {
		chunks.push(content.slice(offset, offset + chunkSize));
	}

	return chunks.length > 0 ? chunks : [''];
}
