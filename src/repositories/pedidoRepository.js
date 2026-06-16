import { connection } from "../configs/Database.js";

const pedidoRepository = {

    criar: async (pedido, itens) => {
        const conn = await connection.getConnection();
        try {
            await conn.beginTransaction();

            // 1. Insere o Pedido
            const sqlPedido = 'INSERT INTO pedidos (idCliente, SubTotal, Status) VALUES (?, ?, ?);';
            const valuesPedido = [pedido.idCliente, pedido.subTotal, pedido.status];
            const [rowsPedido] = await conn.execute(sqlPedido, valuesPedido);
            const idPedido = rowsPedido.insertId;

            // 2. Itera sobre os itens para validar estoque e inserir
            for (const item of itens) {
                // Verificar o estoque atual do produto antes de prosseguir
                const sqlEstoque = 'SELECT nome, qtdEstoque FROM produtos WHERE id = ? FOR UPDATE;';
                // O "FOR UPDATE" bloqueia essa linha temporariamente para evitar problemas de concorrência
                const [produtos] = await conn.execute(sqlEstoque, [item.idProduto]);

                if (produtos.length === 0) {
                    throw new Error(`Produto com ID ${item.idProduto} não encontrado`);
                }

                const produtoAtual = produtos[0];

                // Valida se a quantidade pedida está disponível em estoque
                if (produtoAtual.qtdEstoque < item.quantidade) {
                    throw new Error(`Estoque insuficiente para o produto "${produtoAtual.nome}". Disponível: ${produtoAtual.qtdEstoque}`);
                }

                // 3. Deduzir a quantidade do estoque do produto
                const sqlAtualizarEstoque = 'UPDATE produtos SET qtdEstoque = qtdEstoque - ? WHERE id = ?;';
                await conn.execute(sqlAtualizarEstoque, [item.quantidade, item.idProduto]);

                // 4. Insere o item do pedido
                const sqlItens = 'INSERT INTO itens_pedidos (idPedido, idProduto, Quantidade, ValorItem) VALUES (?, ?, ?, ?);';
                const valuesItens = [idPedido, item.idProduto, item.quantidade, item.valorItem];
                await conn.execute(sqlItens, valuesItens);
            }

            await conn.commit();
            return { rowsPedido };
        } catch (error) {
            await conn.rollback();
            throw error; // Repassa o erro para o controller tratar
        } finally {
            conn.release();
        }
    },

    atualizarStatus: async (idPedido, novoStatus) => {
        const sql = 'UPDATE pedidos SET Status = ? WHERE Id = ?;';
        const [rows] = await connection.execute(sql, [novoStatus, idPedido]);
        return rows;
    },

    selecionar: async () => {
        const sql = `
            SELECT 
                p.Id  AS idPedido, p.idCliente, p.SubTotal, p.Status,ip.Id   AS itemId, ip.idProduto, ip.Quantidade, ip.ValorItem
            FROM pedidos p
            LEFT JOIN itens_pedidos ip ON p.Id = ip.idPedido
            ORDER BY p.Id;
        `;
        const [rows] = await connection.execute(sql);
        return rows;
    },

    adicionarItem: async (item) => {
        const conn = await connection.getConnection();
        try {
            await conn.beginTransaction();

            const sqlInsert = `
                INSERT INTO itens_pedidos (idPedido, idProduto, Quantidade, ValorItem)
                VALUES (?, ?, ?, ?);
            `;
            const [rowsItem] = await conn.execute(sqlInsert, [
                item.idPedido,
                item.idProduto,
                item.quantidade,
                item.valorItem
            ]);

            const [rowsSubTotal] = await conn.execute(
                'SELECT SUM(Quantidade * ValorItem) AS total FROM itens_pedidos WHERE idPedido = ?;', [item.idPedido]// calculo para retornar o total do pedido.
            );
            const novoSubTotal = rowsSubTotal[0].total || 0;

            await conn.execute(
                'UPDATE pedidos SET SubTotal = ? WHERE Id = ?;',
                [novoSubTotal, item.idPedido]
            );

            await conn.commit();
            return { rowsItem, novoSubTotal };
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    },


    editarItem: async (itemId, idPedido, quantidade) => {
        const conn = await connection.getConnection();
        try {
            await conn.beginTransaction();

            const [rowsUpdate] = await conn.execute(
                'UPDATE itens_pedidos SET Quantidade = ? WHERE Id = ? AND idPedido = ?;',
                [quantidade, itemId, idPedido]
            );

            if (rowsUpdate.affectedRows === 0) {
                throw new Error('Item não encontrado para este pedido');
            }

            const [rowsSubTotal] = await conn.execute(
                'SELECT SUM(Quantidade * ValorItem) AS total FROM itens_pedidos WHERE idPedido = ?;',
                [idPedido]
            );

            const novoSubTotal = rowsSubTotal[0].total || 0;

            await conn.execute(
                'UPDATE pedidos SET SubTotal = ? WHERE Id = ?;',
                [novoSubTotal, idPedido]
            );

            await conn.commit();
            return { rowsUpdate, novoSubTotal };

        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    },

    excluirItem: async (itemId, idPedido) => {
        const conn = await connection.getConnection();
        try {
            await conn.beginTransaction();

            const [rowsDelete] = await conn.execute(
                'DELETE FROM itens_pedidos WHERE Id = ? AND idPedido = ?;',
                [itemId, idPedido]
            );

            if (rowsDelete.affectedRows === 0) {
                throw new Error('Item não encontrado para este pedido');
            }

            const [rowsSubTotal] = await conn.execute(
                'SELECT SUM(Quantidade * ValorItem) AS total FROM itens_pedidos WHERE idPedido = ?;',
                [idPedido]
            );

            const novoSubTotal = rowsSubTotal[0].total || 0;

            await conn.execute(
                'UPDATE pedidos SET SubTotal = ? WHERE Id = ?;',
                [novoSubTotal, idPedido]
            );

            await conn.commit();
            return { rowsDelete, novoSubTotal };

        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    }
};

export default pedidoRepository;