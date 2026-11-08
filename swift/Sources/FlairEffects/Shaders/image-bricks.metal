// flair-metal-hash: 1a40d8fc
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

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
    int uStyle;
    float uCell;
    float uLevels;
    uint uBuild;
    float uProgress;
    float3 uBase;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_bricks_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _108)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_108.uBackdrop) * _108.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_108.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _108)
{
    float4 _249;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _249 = overBackdrop(param, _108);
    }
    else
    {
        float2 param_1 = fract(uv);
        _249 = float4(testCard(param_1), 1.0);
    }
    return _249;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float3 brick(thread const float3& c, thread const float2& q, thread const float& aa)
{
    float edge = 0.5 - fast::max(abs(q.x), abs(q.y));
    float3 col = c * (1.0 + ((0.2199999988079071044921875 * sign(q.y - q.x)) * (1.0 - smoothstep(0.0, 0.070000000298023223876953125, edge))));
    col *= mix(0.550000011920928955078125, 1.0, smoothstep(0.0, aa * 1.5, edge));
    float r = 0.300000011920928955078125;
    col *= mix(0.7200000286102294921875, 1.0, smoothstep(r - aa, r + (aa * 2.0), length(q - float2(0.0500000007450580596923828125, -0.0500000007450580596923828125))));
    float d = length(q);
    float lit = dot(q / float2(fast::max(d, 9.9999997473787516355514526367188e-05)), float2(-0.707099974155426025390625, 0.707099974155426025390625));
    float3 top = c * (1.059999942779541015625 + ((smoothstep(r - 0.07999999821186065673828125, r, d) * lit) * 0.3499999940395355224609375));
    return mix(col, top, float3(smoothstep(r + aa, r - aa, d)));
}

static inline __attribute__((always_inline))
float3 bead(thread const float3& c, thread const float2& q, thread const float& aa, thread const bool& placed, constant FlairUniforms& _108)
{
    float d = length(q);
    float3 col = _108.uBase * mix(0.800000011920928955078125, 1.0, smoothstep(0.0, aa * 2.0, abs(d - 0.36000001430511474609375) - 0.119999997317790985107421875));
    col = mix(col, _108.uBase * 0.819999992847442626953125, float3(smoothstep(0.119999997317790985107421875 + aa, 0.119999997317790985107421875 - aa, d)));
    if (!placed)
    {
        return col;
    }
    float ring = smoothstep(aa, -aa, abs(d - 0.310000002384185791015625) - 0.14000000059604644775390625);
    float lit = dot(q / float2(fast::max(d, 9.9999997473787516355514526367188e-05)), float2(-0.707099974155426025390625, 0.707099974155426025390625));
    float3 b = (c * (0.89999997615814208984375 + ((0.25 * lit) * smoothstep(0.17000000178813934326171875, 0.449999988079071044921875, d)))) + float3(0.25 * smoothstep(0.0599999986588954925537109375, 0.0, length(q - float2(-0.20000000298023223876953125, 0.20000000298023223876953125))));
    return mix(col, b, float3(ring));
}

static inline __attribute__((always_inline))
float3 stitch(thread const float3& c, thread const float2& q, thread const float& aa, thread const bool& placed, constant FlairUniforms& _108)
{
    float2 corner = float2(0.5) - abs(q);
    float3 col = _108.uBase * (0.9700000286102294921875 - (0.25 * smoothstep(0.100000001490116119384765625, 0.0, length(corner))));
    col *= (0.9700000286102294921875 + (0.02999999932944774627685546875 * sin((q.x + q.y) * 60.0)));
    bool _481 = !placed;
    bool _494;
    if (!_481)
    {
        _494 = fast::max(abs(q.x), abs(q.y)) > 0.439999997615814208984375;
    }
    else
    {
        _494 = _481;
    }
    if (_494)
    {
        return col;
    }
    float w = 0.12999999523162841796875;
    float under = abs(q.x + q.y) * 0.707099974155426025390625;
    float over = abs(q.x - q.y) * 0.707099974155426025390625;
    if (under < w)
    {
        col = (c * (0.7799999713897705078125 + (0.119999997317790985107421875 * sin((q.x - q.y) * 50.0)))) * (1.0 - (0.3499999940395355224609375 * powr(under / w, 2.0)));
    }
    if (over < w)
    {
        col = (c * (0.89999997615814208984375 + (0.119999997317790985107421875 * sin((q.x + q.y) * 50.0)))) * (1.0 - (0.3499999940395355224609375 * powr(over / w, 2.0)));
    }
    return col;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _108, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 cell = floor(fragCoord / float2(_108.uCell));
    float2 q = ((fragCoord / float2(_108.uCell)) - cell) - float2(0.5);
    float aa = 1.0 / _108.uCell;
    float2 param = ((cell + float2(0.5)) * _108.uCell) / float2(_108.iResolution[0], _108.iResolution[1]);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _108);
    float steps = _108.uLevels - 1.0;
    float3 c = floor((pic.xyz * steps) + float3(0.5)) / float3(steps);
    float rows = ceil(_108.iResolution[1u] / _108.uCell);
    float _633;
    if (_108.uBuild != 0u)
    {
        _633 = fast::clamp(fract(_108.iTime / 6.0) * 1.2000000476837158203125, 0.0, 1.0);
    }
    else
    {
        _633 = _108.uProgress;
    }
    float p = _633;
    float2 param_1 = cell;
    float order = (cell.y + (hash12(param_1) * 3.0)) / (rows + 3.0);
    bool placed = (order < p) || (p >= 1.0);
    float3 col;
    if (_108.uStyle == 0)
    {
        float3 _677;
        if (placed)
        {
            float3 param_2 = c;
            float2 param_3 = q;
            float param_4 = aa;
            _677 = brick(param_2, param_3, param_4);
        }
        else
        {
            float3 param_5 = _108.uBase;
            float2 param_6 = q;
            float param_7 = aa;
            _677 = brick(param_5, param_6, param_7);
        }
        col = _677;
    }
    else
    {
        if (_108.uStyle == 1)
        {
            float3 param_8 = c;
            float2 param_9 = q;
            float param_10 = aa;
            bool param_11 = placed;
            col = bead(param_8, param_9, param_10, param_11, _108);
        }
        else
        {
            float3 param_12 = c;
            float2 param_13 = q;
            float param_14 = aa;
            bool param_15 = placed;
            col = stitch(param_12, param_13, param_14, param_15, _108);
        }
    }
    fragColor = float4(col, step(0.5, pic.w));
}

fragment flair_image_bricks_frag_out flair_image_bricks_frag(constant FlairUniforms& _108 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_bricks_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _742;
    if (_108.flair_flipY > 0.5)
    {
        _742 = _108.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _742 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _742);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _108, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

