// flair-metal-hash: 6b37ae72
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
    uint uAnimate;
    float uProgress;
    float uCell;
    float uSpread;
    float uTwist;
    uint uUpright;
    char _m19_pad[8];
    packed_float3 uEdge;
    float uEdgeGlow;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_pixel_bloom_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _77)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_77.uBackdrop) * _77.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_77.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _77)
{
    float4 _221;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _221 = overBackdrop(param, _77);
    }
    else
    {
        float2 param_1 = fract(uv);
        _221 = float4(testCard(param_1), 1.0);
    }
    return _221;
}

static inline __attribute__((always_inline))
float squareCount(constant FlairUniforms& _77)
{
    float reach = ((0.5 * length(float2(_77.iResolution[0], _77.iResolution[1]))) / _77.uCell) + 2.0;
    return ceil(reach * reach);
}

static inline __attribute__((always_inline))
float grownAt(thread const float& rn, constant FlairUniforms& _77, thread float& gProgress)
{
    float w = _77.uSpread;
    return fast::clamp(((gProgress * (1.0 + w)) - rn) / w, 0.0, 1.0);
}

static inline __attribute__((always_inline))
float squareSide(thread const float& n, thread const float& rn, constant FlairUniforms& _77, thread float& gProgress)
{
    float param = rn;
    float k = grownAt(param, _77, gProgress);
    return 2.2999999523162841796875 * smoothstep(0.0, 1.0, k);
}

static inline __attribute__((always_inline))
float squareTurn(thread const float& n, thread const float& a, constant FlairUniforms& _77, thread float& gProgress, thread float& gRoot)
{
    float param = sqrt(n) / gRoot;
    return ((_77.uUpright != 0u) ? 0.0 : a) + ((1.0 - grownAt(param, _77, gProgress)) * 1.57079994678497314453125);
}

static inline __attribute__((always_inline))
float4 phyllo(thread const float2& p, thread const float& count, thread const float& twist, thread const float& maxSide, thread const float& aa, constant FlairUniforms& _77, thread float& gProgress, thread float& gRoot)
{
    float r = length(p);
    float reach = ((maxSide * 0.707199990749359130859375) + aa) + 0.0500000007450580596923828125;
    float lo = fast::max(1.0, floor(fast::max(r - reach, 0.0) * fast::max(r - reach, 0.0)));
    float hi = fast::min(count, ceil((r + reach) * (r + reach)));
    float root = sqrt(fast::max(count, 1.0));
    float theta = precise::atan2(p.y, p.x);
    float4 best = float4(0.0, 0.0, 0.0, 1000.0);
    for (int i = 0; i < 200; i++)
    {
        float n = lo + float(i);
        if (n > hi)
        {
            break;
        }
        float rn = sqrt(n);
        float a = (n * 2.3999631404876708984375) + (twist * rn);
        float dt = abs(mod((a - theta) + 3.1415927410125732421875, 6.283185482025146484375) - 3.1415927410125732421875);
        if (((0.636619985103607177734375 * fast::min(r, rn)) * dt) > reach)
        {
            continue;
        }
        float param = n;
        float param_1 = rn / root;
        float side = squareSide(param, param_1, _77, gProgress);
        if (side <= 0.0)
        {
            continue;
        }
        float2 d = p - (float2(cos(a), sin(a)) * rn);
        float param_2 = n;
        float param_3 = a;
        float t = squareTurn(param_2, param_3, _77, gProgress, gRoot);
        float c = cos(t);
        float s = sin(t);
        d = float2((c * d.x) + (s * d.y), ((-s) * d.x) + (c * d.y));
        float h = side * 0.5;
        float _round = h * 0.2199999988079071044921875;
        float2 q = abs(d) - float2(h - _round);
        float sd = (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - _round;
        float cover = fast::clamp(0.5 - (sd / aa), 0.0, 1.0);
        bool _436 = cover > best.x;
        bool _451;
        if (!_436)
        {
            bool _443 = cover == best.x;
            bool _450;
            if (_443)
            {
                _450 = sd < best.w;
            }
            else
            {
                _450 = _443;
            }
            _451 = _450;
        }
        else
        {
            _451 = _436;
        }
        if (_451)
        {
            best = float4(cover, n, rn / root, sd);
        }
    }
    return best;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _77, thread float& gProgress, thread float& gRoot, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float _535;
    if (_77.uAnimate != 0u)
    {
        _535 = smoothstep(0.0500000007450580596923828125, 0.949999988079071044921875, 0.5 - (0.5 * cos((_77.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _535 = _77.uProgress;
    }
    gProgress = _535;
    float2 uv = fragCoord / float2(_77.iResolution[0], _77.iResolution[1]);
    if (gProgress <= 0.0)
    {
        float2 param = uv;
        fragColor = pictureRGBA(uFrom, uFromSmplr, param, _77);
        return;
    }
    if (gProgress >= 1.0)
    {
        float2 param_1 = uv;
        fragColor = pictureRGBA(uTo, uToSmplr, param_1, _77);
        return;
    }
    float2 q = (fragCoord - (float2(_77.iResolution[0], _77.iResolution[1]) * 0.5)) / float2(_77.uCell);
    float count = squareCount(_77);
    gRoot = sqrt(count);
    float2 param_2 = q;
    float param_3 = count;
    float param_4 = _77.uTwist * 0.4000000059604644775390625;
    float param_5 = 2.2999999523162841796875;
    float param_6 = 1.2000000476837158203125 / _77.uCell;
    float4 hit = phyllo(param_2, param_3, param_4, param_5, param_6, _77, gProgress, gRoot);
    float2 param_7 = uv;
    float4 from = pictureRGBA(uFrom, uFromSmplr, param_7, _77);
    float2 param_8 = uv;
    float4 to = pictureRGBA(uTo, uToSmplr, param_8, _77);
    float4 c = mix(from, to, float4(hit.x));
    float param_9 = hit.z;
    float k = grownAt(param_9, _77, gProgress);
    float edge = ((((_77.uEdgeGlow * hit.x) * 4.0) * k) * (1.0 - k)) * exp((-fast::max(-hit.w, 0.0)) / 0.25);
    float4 _654 = c;
    float3 _662 = mix(_654.xyz, float3(_77.uEdge), float3(fast::clamp(edge, 0.0, 1.0)));
    c.x = _662.x;
    c.y = _662.y;
    c.z = _662.z;
    fragColor = c;
}

fragment flair_transition_pixel_bloom_frag_out flair_transition_pixel_bloom_frag(constant FlairUniforms& _77 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_pixel_bloom_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float gProgress;
    float gRoot;
    float _682;
    if (_77.flair_flipY > 0.5)
    {
        _682 = _77.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _682 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _682);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _77, gProgress, gRoot, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

