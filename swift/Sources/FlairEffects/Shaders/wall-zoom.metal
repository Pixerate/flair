// flair-metal-hash: 6558facf
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    int uCount;
    int uGrid;
    float uHold;
    float uGap;
    float uTint;
    float uRadius;
    float3 uGapColor;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_wall_zoom_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float ease(thread float& t)
{
    t = fast::clamp(t, 0.0, 1.0);
    return (t * t) * (3.0 - (2.0 * t));
}

static inline __attribute__((always_inline))
float hash11(thread const float& n)
{
    return fract(sin((n * 127.09999847412109375) + 11.69999980926513671875) * 43758.546875);
}

static inline __attribute__((always_inline))
int2 itemSize(thread const int& i, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    if (i == 0)
    {
        return int2(uItem0.get_width(), uItem0.get_height());
    }
    if (i == 1)
    {
        return int2(uItem1.get_width(), uItem1.get_height());
    }
    if (i == 2)
    {
        return int2(uItem2.get_width(), uItem2.get_height());
    }
    if (i == 3)
    {
        return int2(uItem3.get_width(), uItem3.get_height());
    }
    if (i == 4)
    {
        return int2(uItem4.get_width(), uItem4.get_height());
    }
    return int2(uItem5.get_width(), uItem5.get_height());
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _83)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_83.uBackdrop) * _83.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_83.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _83)
{
    float4 _226;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _226 = overBackdrop(param, _83);
    }
    else
    {
        float2 param_1 = fract(uv);
        _226 = float4(testCard(param_1), 1.0);
    }
    return _226;
}

static inline __attribute__((always_inline))
float4 itemAt(thread const int& i, thread const float2& uv, constant FlairUniforms& _83, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    if (i == 0)
    {
        float2 param = uv;
        return pictureRGBA(uItem0, uItem0Smplr, param, _83);
    }
    if (i == 1)
    {
        float2 param_1 = uv;
        return pictureRGBA(uItem1, uItem1Smplr, param_1, _83);
    }
    if (i == 2)
    {
        float2 param_2 = uv;
        return pictureRGBA(uItem2, uItem2Smplr, param_2, _83);
    }
    if (i == 3)
    {
        float2 param_3 = uv;
        return pictureRGBA(uItem3, uItem3Smplr, param_3, _83);
    }
    if (i == 4)
    {
        float2 param_4 = uv;
        return pictureRGBA(uItem4, uItem4Smplr, param_4, _83);
    }
    float2 param_5 = uv;
    return pictureRGBA(uItem5, uItem5Smplr, param_5, _83);
}

static inline __attribute__((always_inline))
float4 itemCover(thread const int& i, thread float2& uv, thread const float& aspect, constant FlairUniforms& _83, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    int param = i;
    int2 ts = itemSize(param, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    bool _400 = ts.x > 1;
    bool _406;
    if (_400)
    {
        _406 = ts.y > 1;
    }
    else
    {
        _406 = _400;
    }
    if (_406)
    {
        float ta = float(ts.x) / float(ts.y);
        if (ta > aspect)
        {
            uv.x = (((uv.x - 0.5) * aspect) / ta) + 0.5;
        }
        else
        {
            uv.y = (((uv.y - 0.5) * ta) / aspect) + 0.5;
        }
    }
    int param_1 = i;
    float2 param_2 = uv;
    return itemAt(param_1, param_2, _83, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
}

static inline __attribute__((always_inline))
float tileBox(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _83, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    float2 uv = fragCoord / float2(_83.iResolution[0], _83.iResolution[1]);
    float aspect = _83.iResolution[0u] / _83.iResolution[1u];
    float px = 1.0 / _83.iResolution[1u];
    int n = clamp(_83.uCount, 1, 6);
    float g = float((2 * (clamp(_83.uGrid, 3, 9) / 2)) + 1);
    float c = _83.iTime / fast::max(_83.uHold, 0.100000001490116119384765625);
    float k = floor(c);
    float u = c - k;
    int cur = int(mod(k, float(n)));
    int next = int(mod(k + 1.0, float(n)));
    float param = u / 0.25;
    float _515 = ease(param);
    float mosaic = _515;
    float param_1 = (u - 0.300000011920928955078125) / 0.550000011920928955078125;
    float _523 = ease(param_1);
    float z = _523;
    float zoom = powr(g, z);
    float2 w = ((uv - float2(0.5)) / float2(zoom)) + float2(0.5);
    float2 cell = floor(w * g);
    float2 lw = (w * g) - cell;
    bool middle = all(cell == float2(floor(0.5 * g)));
    int _560;
    if (middle)
    {
        _560 = next;
    }
    else
    {
        float param_2 = dot(cell, float2(1.0, 17.0)) + (k * 7.13000011444091796875);
        _560 = int(floor(hash11(param_2) * float(n)));
    }
    int item = _560;
    int param_3 = item;
    float2 param_4 = lw;
    float param_5 = aspect;
    float4 _588 = itemCover(param_3, param_4, param_5, _83, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    float4 tile = _588;
    int param_6 = cur;
    float2 param_7 = (cell + float2(0.5)) / float2(g);
    float param_8 = aspect;
    float4 _601 = itemCover(param_6, param_7, param_8, _83, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    float3 tint = _601.xyz;
    float luma = dot(tile.xyz, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625));
    float3 col = mix(tile.xyz, tint * (0.3499999940395355224609375 + (0.949999988079071044921875 * luma)), float3(_83.uTint * (1.0 - z)));
    float2 toEdge = ((fast::min(lw, float2(1.0) - lw) * float2(aspect, 1.0)) * zoom) / float2(g);
    float gap = _83.uGap * (1.0 - z);
    float2 param_9 = (((lw - float2(0.5)) * float2(aspect, 1.0)) * zoom) / float2(g);
    float2 param_10 = ((float2(0.5 * aspect, 0.5) * zoom) / float2(g)) - float2(0.5 * gap);
    float param_11 = _83.uRadius * (1.0 - z);
    float inTile = smoothstep(px, -px, tileBox(param_9, param_10, param_11));
    col = mix(col, _83.uGapColor, float3((1.0 - inTile) * step(0.0005000000237487256526947021484375, gap)));
    int param_12 = cur;
    float2 param_13 = uv;
    float param_14 = aspect;
    float4 _707 = itemCover(param_12, param_13, param_14, _83, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    float4 whole = _707;
    float alpha = mix(whole.w, mix(1.0, tile.w, inTile), mosaic);
    fragColor = float4(mix(whole.xyz, col, float3(mosaic)), alpha);
}

fragment flair_wall_zoom_frag_out flair_wall_zoom_frag(constant FlairUniforms& _83 [[buffer(0)]], texture2d<float> uItem0 [[texture(1)]], texture2d<float> uItem1 [[texture(2)]], texture2d<float> uItem2 [[texture(3)]], texture2d<float> uItem3 [[texture(4)]], texture2d<float> uItem4 [[texture(5)]], texture2d<float> uItem5 [[texture(6)]], sampler uItem0Smplr [[sampler(1)]], sampler uItem1Smplr [[sampler(2)]], sampler uItem2Smplr [[sampler(3)]], sampler uItem3Smplr [[sampler(4)]], sampler uItem4Smplr [[sampler(5)]], sampler uItem5Smplr [[sampler(6)]], float4 gl_FragCoord [[position]])
{
    flair_wall_zoom_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _740;
    if (_83.flair_flipY > 0.5)
    {
        _740 = _83.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _740 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _740);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _83, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

